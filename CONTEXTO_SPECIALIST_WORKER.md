# Contexto Tecnico: Specialist Worker — Painel de Especialistas IA

## O que foi construido

Um sistema onde **5 especialistas IA independentes** analisam conteudo politico em paralelo, cada um com seu proprio prompt e perspectiva. Os pareceres alimentam a DUDA (estrategista principal) na analise final.

---

## Arquitetura Geral

```
                    SUPABASE                         DIGITAL OCEAN                        VERCEL (Next.js)
           ┌─────────────────────┐           ┌──────────────────────────┐           ┌─────────────────────┐
           │ arena_prompts table │           │ specialist-worker/       │           │ /api/arena/analise  │
           │                     │           │ (FastAPI - porta 3011)   │           │                     │
           │ specialist_comunic..│──cache──→│                          │←──POST───│ 1. Monta payload    │
           │ specialist_religio..│  5 min   │ POST /analyze            │           │    (segments, etc)  │
           │ specialist_marketi..│          │  ├─ load_prompts()       │           │                     │
           │ specialist_psicolo..│          │  ├─ build_context()      │──JSON──→ │ 2. Recebe 5         │
           │ specialist_complia..│          │  └─ asyncio.gather(      │           │    pareceres        │
           │                     │          │       claude(prompt1),   │           │                     │
           │ (editavel pelo      │          │       claude(prompt2),   │           │ 3. Injeta pareceres │
           │  Supabase Dashboard │          │       claude(prompt3),   │           │    no prompt DUDA   │
           │  sem redeploy)      │          │       claude(prompt4),   │           │                     │
           └─────────────────────┘          │       claude(prompt5),   │           │ 4. Claude Opus      │
                                             │     )                    │           │    (DUDA) gera      │
                                             │                          │           │    analise final     │
                                             │ GET /health              │           │                     │
                                             └──────────────────────────┘           │ 5. Injeta panel     │
                                                                                     │    no JSON final    │
                                                                                     └─────────────────────┘
```

---

## Fluxo passo a passo

1. O Arena termina a simulacao de ~2000 personas sinteticas
2. O frontend faz POST em `/api/arena/analise` (Next.js no Vercel)
3. O Next.js faz POST em `SPECIALIST_WORKER_URL/analyze` (Python no Digital Ocean)
4. O Python carrega os 5 prompts do Supabase (com cache de 5 min)
5. O Python monta um **contexto unico** com todos os dados demograficos
6. O Python dispara **5 chamadas Claude Sonnet em paralelo** (asyncio.gather), cada uma com seu prompt individual + o contexto compartilhado
7. O Python monta o painel consolidado (consensus + divergences + 5 specialist results)
8. O painel volta ao Next.js
9. O Next.js injeta os pareceres no prompt da DUDA (Claude Opus) como contexto adicional
10. A DUDA gera sua analise incorporando as perspectivas dos especialistas
11. O Next.js injeta o `specialistPanel` original (do Python) no JSON final
12. O frontend renderiza tudo: analise da DUDA + painel de especialistas expansivel

---

## Arquivos do Python (specialist-worker/)

### `specialist-worker/config.py`
Carrega variaveis de ambiente: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (3011), `SPECIALIST_MODEL` (claude-sonnet-4), `SPECIALIST_MAX_TOKENS` (1024).

### `specialist-worker/specialists.py`
Define:
- **SPECIALISTS dict**: metadados de cada especialista (id, name, emoji, prompt_id para lookup no Supabase)
- **OUTPUT_SCHEMA**: schema JSON padronizado que e CONCATENADO ao final de todo prompt de especialista. Define: verdict (max 80 chars), riskLevel, keyPoints (2-3 com dados), recommendations (1-2 acionaveis), dataHighlight
- **build_context()**: recebe o payload da analise e monta uma string de contexto com resultado geral (% favor/contra/neutro), contexto do conteudo (plataforma, ideologia, regiao, tipo de midia), breakdown demografico completo (genero, religiao, raca, regiao, geracao, classe social, escolaridade, posicao politica, voto 2022, intencao 2026, cluster macro, arquetipo). Todos os 5 especialistas recebem esse MESMO contexto — o que muda e o prompt (system message)

### `specialist-worker/server.py`
FastAPI com:
- **load_prompts()**: busca os 5 prompts da tabela `arena_prompts` no Supabase filtrando por `is_active = true`. Cache de 5 minutos (TTL 300s). Se falhar, usa cache antigo (stale cache). Cada prompt e identificado pelo `prompt_id` do specialist (ex: `specialist_comunicacao_politica`)
- **run_specialist()**: recebe specialist_id, context, prompts. Monta system_prompt = prompt_supabase + OUTPUT_SCHEMA. Chama Claude Sonnet via AsyncAnthropic. Faz parse do JSON de resposta. Retorna SpecialistResult (id, name, emoji, verdict, riskLevel, keyPoints, recommendations, dataHighlight). Tem fallback para erro de parse e erro generico
- **build_consensus()**: conta riskLevels dos 5 especialistas. Se 3+ altos → alerta. Se 3+ baixos → conteudo ok. Senao → divergencia
- **find_divergences()**: se algum especialista tem risco alto E outro tem baixo, monta string descrevendo quem diverge
- **POST /analyze**: endpoint principal. Carrega prompts, monta contexto, dispara 5 specialists via `asyncio.gather()`, monta painel com consensus/divergences/results, retorna SpecialistPanelResponse
- **GET /health**: health check com contagem de prompts carregados

---

## Prompts no Supabase

Tabela: `arena_prompts` (ja existia, usada para outros prompts do Arena)

Estrutura:
```sql
id TEXT PRIMARY KEY,        -- ex: "specialist_comunicacao_politica"
name TEXT NOT NULL,         -- ex: "Especialista: Comunicação Política"
description TEXT,           -- descricao curta do foco
content TEXT NOT NULL,      -- o prompt completo do especialista
version INTEGER DEFAULT 1, -- auto-incrementa no update
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ      -- auto-atualiza via trigger
```

Os 5 prompts inseridos:
| ID no Supabase | Especialista | Foco de Analise |
|---|---|---|
| `specialist_comunicacao_politica` | Comunicacao Politica | Narrativa, framing, posicionamento, timing, polarizacao. Dados: politicalLeaning, voto2022, voto2026, clusterMacro |
| `specialist_assuntos_religiosos` | Assuntos Religiosos | Evangelicos, catolicos, sem religiao, linguagem, riscos. Dados: religion, region, generation |
| `specialist_marketing_digital` | Marketing Digital | Hook, retencao, algoritmo, CTA, formato, SEO. Dados: plataformas, attachmentType, generation |
| `specialist_psicologia_social` | Psicologia Social | Gatilhos emocionais, vieses cognitivos, efeito de grupo. Dados: generation, socialClass, education, gender |
| `specialist_compliance_legal` | Compliance Legal | TSE, fake news, discurso de odio, regras de plataforma. Dados: contentMeta, question |

**Para editar um prompt**: abrir Supabase Dashboard → tabela arena_prompts → editar o `content`. Reflete em ate 5 minutos (cache TTL).

---

## Como o Next.js integra (route.ts)

No arquivo `src/app/api/arena/analise/route.ts`:

**Step 1 — Chama o Python:**
```typescript
const specialistRes = await fetch(`${SPECIALIST_WORKER_URL}/analyze`, {
  method: 'POST',
  body: JSON.stringify({ question, positive, negative, neutral, totalPersonas, segments, contentMeta }),
});
const specialistPanel = await specialistRes.json();
```

**Step 2 — Formata pareceres para o prompt da DUDA:**
```
PARECERES DA EQUIPE DE ESPECIALISTAS:
Consenso: Os especialistas concordam que...
Divergencia: Marketing alerta para X, mas Compliance ve Y...

[Comunicacao Politica] (Risco: alto) — Veredicto curto
  Pontos: ponto1; ponto2; ponto3

[Assuntos Religiosos] (Risco: medio) — Veredicto curto
  Pontos: ponto1; ponto2
...
```

**Step 3 — DUDA recebe tudo:**
O prompt da DUDA tem a instrucao: "Use esses pareceres para enriquecer sua analise. Incorpore as perspectivas dos especialistas de forma natural, sem cita-los pelo nome."

**Step 4 — Injeta panel original no JSON:**
Apos a DUDA gerar sua analise, o `specialistPanel` do Python e injetado diretamente no JSON final (nao e gerado pela DUDA):
```typescript
parsed.specialistPanel = {
  consensus: specialistPanel.consensus,
  divergences: specialistPanel.divergences,
  specialists: specialistPanel.specialists.map(s => ({ id, name, emoji, verdict, riskLevel, keyPoints, recommendations, dataHighlight })),
};
```

**Fallback:** Se o Python falhar (timeout 30s ou erro), a DUDA roda normalmente sem pareceres. O campo `specialistPanel` simplesmente nao existe no JSON.

---

## Schema de resposta de cada especialista

Cada especialista retorna (via Claude Sonnet):
```json
{
  "verdict": "Frase direta, max 80 chars",
  "riskLevel": "baixo|medio|alto|critico",
  "keyPoints": ["Ponto com dado numerico", "Outro ponto com dado"],
  "recommendations": [
    { "text": "Acao especifica", "priority": "urgente|importante|oportunidade", "segment": "opcional" }
  ],
  "dataHighlight": "Dado surpreendente (opcional)"
}
```

O Python adiciona os metadados (id, name, emoji) e monta o painel consolidado:
```json
{
  "consensus": "Frase de consenso",
  "divergences": "Onde divergem (ou null)",
  "specialists": [ ...5 resultados... ],
  "processingTimeMs": 3500
}
```

---

## Frontend (AnalysisSummary.tsx)

O painel de especialistas aparece na view expandida ("Ver analise completa"), entre o Projected Score e as Recommendations.

Componentes:
- **SpecialistPanelSection**: renderiza consenso (box emerald), divergencias (box amber) e 5 cards
- **SpecialistCard**: card clicavel/expansivel. Mostra icone + nome + badge de risco + verdict. Ao expandir: keyPoints (bullets), recommendations (com badges de priority), dataHighlight (box accent)

Cores por riskLevel: baixo=emerald, medio=amber, alto=rose, critico=red com glow.

Tipos TypeScript em `src/app/arena/types.ts`:
- `SpecialistId` (union type dos 5 IDs)
- `SpecialistInsight` (id, name, emoji, verdict, riskLevel, keyPoints, recommendations, dataHighlight)
- `SpecialistPanel` (consensus, divergences, specialists[])
- `AnaliseData.specialistPanel?: SpecialistPanel` (campo opcional = backward-compatible)

---

## Deploy

**specialist-worker/Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 3011
CMD ["python", "-u", "server.py"]
```

**Dependencias:** anthropic, fastapi, uvicorn, python-dotenv, supabase

**Digital Ocean app.yaml:** 1 instancia professional-xs, deploy_on_push: false

**Env vars necessarias no DO:**
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Env var no Vercel (Next.js):**
- `SPECIALIST_WORKER_URL` = URL do app no Digital Ocean

---

## Bug fix incluido: extractHighlights()

No `route.ts`, a funcao `extractHighlights()` tinha threshold `total < 10` que gerava metricas distorcidas como "100% dos evangelicos aprovaram" quando o segmento tinha apenas 12 personas.

Correcao: threshold agora e `max(30, 2% do tamanho medio de segmento)`. Tambem adicionado `n=XX` no texto para contextualizar o tamanho da amostra.
