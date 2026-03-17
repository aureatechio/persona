# Skill: Python Worker para Digital Ocean App Platform

TRIGGER when: user asks to create, modify, or debug Python workers/services for Digital Ocean, or mentions "worker", "DO worker", "digital ocean python", "pipeline python", "daemon python".
DO NOT TRIGGER when: frontend/Next.js work, Supabase Edge Functions, or non-Python tasks.

---

## Arquitetura de Referencia (selfie-worker/)

Este projeto ja possui um worker Python em `selfie-worker/` deployado na Digital Ocean App Platform como app "video-duda". Use-o como referencia estrutural para qualquer novo worker.

## Estrutura de Diretorio Padrao

```
nome-do-worker/
  Dockerfile
  requirements.txt
  .dockerignore
  config.py          # Env vars centralizadas
  db.py              # Cliente Supabase + operacoes de banco
  worker.py          # Loop principal (daemon)
  steps/             # Cada etapa do pipeline isolada
    __init__.py
    step_one.py
    step_two.py
    ...
```

## Regras Obrigatorias

### 1. Dockerfile (Digital Ocean App Platform)

```dockerfile
FROM python:3.11-slim

# Instalar dependencias do sistema ANTES do pip
RUN apt-get update && \
    apt-get install -y <pacotes-sistema> && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Se usar PyTorch, SEMPRE CPU-only (DO nao tem GPU)
# RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download modelos pesados no build (evita download em runtime)
# RUN python -c "import whisper; whisper.load_model('base')"

# SEMPRE usar -u para output unbuffered (logs aparecem em tempo real no DO)
CMD ["python", "-u", "worker.py"]
```

Regras do Dockerfile:
- **SEMPRE** `python -u` (unbuffered stdout) — sem isso os logs nao aparecem no DO
- **SEMPRE** `--no-cache-dir` no pip install (reduz tamanho da imagem)
- **SEMPRE** `rm -rf /var/lib/apt/lists/*` apos apt-get
- **NUNCA** incluir CUDA/GPU libs — Digital Ocean App Platform nao tem GPU
- **PRE-DOWNLOAD** modelos ML no build time (ARG + RUN python -c "...")
- Usar `python:3.11-slim` (nao alpine — muitas libs C nao compilam em musl)

### 2. .dockerignore

```
.env
.env.*
__pycache__
*.pyc
.git
.venv
venv
*.md
.DS_Store
```

### 3. config.py — Centralizacao de Env Vars

```python
import os
from dotenv import load_dotenv

load_dotenv()

# Todas as env vars em um unico lugar
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Worker settings com defaults sensoratos
POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "3"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
```

Regras:
- **SEMPRE** usar `os.getenv("VAR", "")` com default vazio (nunca None)
- **SEMPRE** usar `load_dotenv()` para desenvolvimento local
- **NUNCA** hardcodar secrets — tudo via env var
- Validacao de env vars obrigatorias fica no `worker.py` (nao aqui)

### 4. db.py — Cliente Supabase

```python
from __future__ import annotations
import uuid as _uuid
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
WORKER_ID = str(_uuid.uuid4())
```

Regras:
- **SEMPRE** usar `SUPABASE_SERVICE_ROLE_KEY` (nao anon key) — workers rodam server-side
- **SEMPRE** gerar `WORKER_ID` unico por instancia (para distributed locking)
- Operacoes atomicas via RPC do PostgreSQL (nao selects + updates separados)
- Storage bucket `voice-models` e PRIVADO — usar `create_signed_url()` nao `get_public_url()`
- Signed URLs expiram em 1h (`SIGNED_URL_EXPIRY = 3600`)

### 5. worker.py — Loop Principal (Daemon Pattern)

```python
import signal
import sys
import time
import traceback
import logging

from config import POLL_INTERVAL, MAX_RETRIES
import db

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

# ─── Graceful shutdown ─────────────────────────────────────
_shutdown = False

def _handle_signal(signum, _frame):
    global _shutdown
    logger.info("Received signal %d, shutting down gracefully...", signum)
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


def process_item(item: dict):
    """Pipeline principal — cada step e idempotente e resumivel."""
    # ... steps aqui ...
    pass


def main():
    logger.info("Worker starting...")

    # Validar env vars obrigatorias
    from config import SUPABASE_URL
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        sys.exit(1)

    logger.info("Worker ID: %s", db.WORKER_ID)
    logger.info("Polling every %ds. Max retries: %d", POLL_INTERVAL, MAX_RETRIES)

    consecutive_errors = 0

    while not _shutdown:
        try:
            item = db.claim_queued()
            if not item:
                item = db.fetch_resumable()

            if item:
                consecutive_errors = 0
                retry_count = int(item.get("retry_count") or 0)

                if retry_count >= MAX_RETRIES:
                    db.update_status(item["id"], "failed",
                                     error_message=f"Max retries ({MAX_RETRIES}) exceeded")
                    continue

                try:
                    process_item(item)
                except Exception as e:
                    new_retry = retry_count + 1
                    if new_retry < MAX_RETRIES:
                        db.update_status(item["id"], item.get("status", "failed"),
                                         error_message=str(e), retry_count=new_retry)
                    else:
                        db.update_status(item["id"], "failed",
                                         error_message=str(e), retry_count=new_retry)
            else:
                time.sleep(POLL_INTERVAL)

        except Exception as e:
            consecutive_errors += 1
            logger.error("Loop error: %s", e)
            logger.error(traceback.format_exc())
            wait = min(consecutive_errors * 5, 60)
            time.sleep(wait)

    logger.info("Worker shut down.")

if __name__ == "__main__":
    main()
```

Regras do Worker:
- **SEMPRE** tratar SIGTERM e SIGINT (DO envia SIGTERM no deploy/restart)
- **SEMPRE** backoff exponencial em erros consecutivos (max 60s)
- **SEMPRE** retry com contador persistido no banco (nao em memoria)
- **SEMPRE** claim atomico via RPC (nunca SELECT + UPDATE separados)
- **SEMPRE** crash recovery: buscar items "stuck" apos claim de novos
- **SEMPRE** watchdog para auto-fail items travados >30min
- **NUNCA** usar threads/async — manter single-threaded e simples
- **NUNCA** retry infinito — usar MAX_RETRIES (default 3)
- Pipeline steps devem ser **idempotentes** e **resumiveis**

### 6. steps/ — Modularizacao do Pipeline

Cada step em arquivo separado dentro de `steps/`:
- Recebe dados simples (bytes, strings), retorna dados simples
- Nao acessa banco diretamente (quem faz update de status e o worker.py)
- Nao guarda estado — tudo e passado por parametro
- Loga com `logging.getLogger("worker.step_name")`

```python
# steps/exemplo.py
import logging
import requests

logger = logging.getLogger("worker.exemplo")

def executar(input_data: bytes) -> bytes:
    logger.info("Processando %d bytes...", len(input_data))
    # ... logica ...
    return resultado
```

### 7. Deploy na Digital Ocean

**App Spec (app.yaml) para worker:**
```yaml
workers:
  - name: meu-worker
    dockerfile_path: meu-worker/Dockerfile
    source_dir: meu-worker
    instance_count: 1
    instance_size_slug: professional-xs  # 1 vCPU, 1GB RAM
    envs:
      - key: SUPABASE_URL
        value: "${SUPABASE_URL}"
        type: SECRET
      - key: SUPABASE_SERVICE_ROLE_KEY
        value: "${SUPABASE_SERVICE_ROLE_KEY}"
        type: SECRET
```

Regras de Deploy:
- **SEMPRE** usar `deploy_on_push: false` para workers (evita restart durante processamento)
- **SEMPRE** usar component type `workers` (nao `services`) — workers nao precisam de porta HTTP
- Deploy manual via `doctl apps create-deployment <app-id>`
- Para logs: `doctl apps logs <app-id> --type=run`
- App atual: ID `2a5e2bce-afa9-4a14-b1bd-1d0903ece304`, nome "video-duda"

### 8. Concorrencia e Distributed Locking

Quando multiplas instancias do worker rodam simultaneamente:

```sql
-- RPC atomico para claim (PostgreSQL)
CREATE OR REPLACE FUNCTION claim_next_item(worker_id text)
RETURNS SETOF minha_tabela AS $$
  UPDATE minha_tabela
  SET status = 'processing',
      locked_by = worker_id,
      locked_at = now()
  WHERE id = (
    SELECT id FROM minha_tabela
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;
```

Regras:
- **SEMPRE** `FOR UPDATE SKIP LOCKED` para evitar race conditions
- **SEMPRE** `locked_at` timestamp para detectar workers mortos
- **SEMPRE** `locked_by` com WORKER_ID para debug
- Watchdog periodico marca como failed items locked ha >30min

### 9. Integracao com APIs Externas

Pattern para chamadas a APIs externas com polling:

```python
def call_external_api(input_url: str, api_key: str) -> str:
    """Submete job e faz polling ate completar."""
    # Submit
    resp = requests.post(API_URL, json={"input": input_url},
                         headers={"Authorization": f"Bearer {api_key}"})
    resp.raise_for_status()
    job_id = resp.json()["id"]

    # Poll
    for attempt in range(120):  # max ~10min com sleep de 5s
        time.sleep(5)
        status_resp = requests.get(f"{API_URL}/{job_id}",
                                   headers={"Authorization": f"Bearer {api_key}"})
        status_resp.raise_for_status()
        data = status_resp.json()

        if data["status"] == "completed":
            return data["output_url"]
        elif data["status"] == "failed":
            raise RuntimeError(f"API job failed: {data.get('error', 'unknown')}")

    raise TimeoutError(f"API job {job_id} timed out after 10 minutes")
```

### 10. Key Pool / Rate Limiting

Quando a API externa tem limites por chave, usar pool de chaves com slots:

```sql
-- Tabela de chaves
CREATE TABLE api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    access_key text NOT NULL,
    max_concurrent int DEFAULT 1,
    current_load int DEFAULT 0,
    is_active boolean DEFAULT true
);

-- Claim atomico (round-robin por menor carga)
CREATE OR REPLACE FUNCTION claim_api_slot(p_item_id uuid)
RETURNS uuid AS $$
DECLARE v_key_id uuid;
BEGIN
    SELECT id INTO v_key_id FROM api_keys
    WHERE is_active AND current_load < max_concurrent
    ORDER BY current_load ASC, random()
    LIMIT 1 FOR UPDATE SKIP LOCKED;

    IF v_key_id IS NULL THEN RETURN NULL; END IF;

    UPDATE api_keys SET current_load = current_load + 1 WHERE id = v_key_id;
    -- Track which item holds the slot
    UPDATE minha_tabela SET api_key_id = v_key_id WHERE id = p_item_id;
    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;
```

### 11. requirements.txt

```
# Core
requests>=2.31.0
supabase>=2.0.0
python-dotenv>=1.0.0

# Adicionar conforme necessidade:
# openai>=1.0.0          # GPT-4o
# openai-whisper>=20231117  # Transcricao local
# PyJWT>=2.8.0           # JWT para APIs que precisam
```

Regras:
- **SEMPRE** versao minima com `>=` (nunca pin exato em workers)
- **NUNCA** incluir libs de GPU (torch com CUDA, etc)
- Manter enxuto — cada dependencia e tempo de build

### 12. Debugging e Monitoramento

```python
# Logs estruturados para facilitar busca no DO
logger.info("Step %d/%d: %s (item=%s)", step_num, total_steps, step_name, item_id)
logger.error("Pipeline error for %s: %s", item_id, error_msg)
logger.error(traceback.format_exc())  # Stack trace completo em erros
```

- Logs no DO: `doctl apps logs <app-id> --type=run --follow`
- Console: https://cloud.digitalocean.com/apps/<app-id>/logs
- Restart manual: `doctl apps create-deployment <app-id>`

---

## Checklist para Novo Worker

1. [ ] Criar diretorio com estrutura padrao
2. [ ] config.py com todas env vars
3. [ ] db.py com client Supabase + WORKER_ID
4. [ ] worker.py com graceful shutdown + retry + watchdog
5. [ ] steps/ com cada etapa isolada
6. [ ] Dockerfile com python -u + pre-download de modelos
7. [ ] .dockerignore
8. [ ] requirements.txt enxuto
9. [ ] RPCs no Supabase para claims atomicos
10. [ ] Testar local com `python -u worker.py`
11. [ ] Deploy no DO App Platform como `worker` component
