# Contexto Completo: Arena Analysis v3 — Aggregate Engine + Duda Marqueteira

> Use este arquivo para alimentar outros chats com o contexto completo da funcionalidade implementada.

---

## Visao Geral

O Arena e um sistema de analise de opiniao publica que simula como 20.000 personas sinteticas brasileiras reagiriam a um conteudo politico (post, imagem, video, audio). O resultado e um dashboard com scores 0-10 por segmento demografico, comentarios simulados e recomendacoes estrategicas.

---

## Arquitetura Atual (v3.0 — Aggregate Engine)

### Stack

- **Backend Python:** FastAPI rodando na Digital Ocean App Platform (`arena-analysis-api`)
- **Frontend:** Next.js 16 + React 19 (PWA em `/arena`) + App mobile Expo/React Native
- **Banco:** Supabase (PostgreSQL) — tabelas `personas` (20k rows) e `arena_sentiment_profile`
- **Modelos IA:** GPT-4o (analise agregada), Claude Haiku (context builder), GPT-4o-mini (pre-classifier), Claude Opus (Duda/recomendacoes)
- **Comunicacao:** SSE (Server-Sent Events) entre backend Python e frontend

### Deploy

- **App DO:** `arena-analysis-api` (ID: `a38cc4e4-e921-4577-b047-5254572d249c`)
- **URL:** `https://arena-analysis-api-2puat.ondigitalocean.app`
- **Instancia:** `apps-s-1vcpu-2gb` (1 vCPU, 2GB RAM)
- **Deploy:** `deploy_on_push: true` (auto-deploy a cada push em main)
- **Dockerfile:** `scripts/arena_analysis/Dockerfile`
- **Health check:** `GET /api/arena/health` (20s delay, 30s interval, 5 failures)

---

## Fluxo Completo (Pipeline de Analise)

### Fase 1: Preparacao (Steps 1-4) — ~10-15 segundos

```
USUARIO submete conteudo (texto/imagem/video) + plataforma + regiao
         |
         v
[Step 1] WEB RESEARCH (Tavily API)
         - Busca noticias/contexto sobre nomes e eventos mencionados
         - Claude decide se precisa buscar ou se conhecimento proprio basta
         |
[Step 2] CONTEXT BUILDER (Claude Haiku)
         - Contextualiza: QUEM + QUAL CARGO + O QUE FEZ
         - Gera 3-5 frases factuais
         |
[Step 3] IDEOLOGICAL FRAME (Claude Haiku)
         - Mapeia como esquerda e direita veem o tema
         |
[Step 4] PRE-CLASSIFIER (GPT-4o-mini)
         - Classifica: political_figure / policy_topic / moral_extreme / factual
         - Detecta figuras politicas e stance (attack/defense/neutral)
         - Gera bloco de desambiguacao
```

### Fase 2: Aggregate Engine (Step 5) — ~60s de UX

**ANTES (v2):** 20.000 chamadas individuais ao GPT-4o-mini. Custo: $5.46. Tempo: 5-7 min.

**AGORA (v3):** 1 chamada ao GPT-4o com sentimento geral pre-computado.

```
[Step 5a] CARREGAR PERFIL AGREGADO (arena_sentiment_profile do Supabase, cached)
         |
[Step 5b] MONTAR PROMPT com conteudo + perfil estatistico completo
         |
[Step 5c] 1 CHAMADA GPT-4o (~15K input, ~8-12K output, ~$0.12)
         O modelo DERIVA scores logicamente — nao simula respostas individuais
         |
[Step 5d] PROGRESS SINTETICO (60s de animacao enquanto modelo processa)
         5s→1000/20k, 10s→3000, 18s→5500, 25s→8000, 33s→11000, 40s→14000, 48s→17000, 55s→19500, 60s→20000
         |
[Step 5e] PONTOS IDEOLOGICOS (~800 pontos sinteticos por cluster)
```

### Fase 3: Duda Marqueteira (Step 6) — ~20-30 segundos

```
[Step 6] DUDA — Claude Opus gera recomendacoes
         - Persona: marqueteira politica, 20 anos de experiencia
         - Fala direto ao politico: "Voce precisa entender que..."
         - Output: headline, platformSummaries, recommendations, nextSteps, radar, projectedScore
```

### Fase 4: Animacao Final — ~23 segundos

```
[Frontend] ANALYSIS PROGRESS LOADER (time-based)
           6 stages: 15%→35%→55%→75%→90%→97%
```

---

## Tabela: arena_sentiment_profile

```sql
CREATE TABLE arena_sentiment_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_personas INTEGER NOT NULL,
  demographics JSONB NOT NULL,
  electoral JSONB NOT NULL,
  ideological JSONB NOT NULL,
  clusters JSONB NOT NULL,
  thematic_opinions JSONB NOT NULL,
  geographic JSONB NOT NULL,
  cross_tabulations JSONB NOT NULL,
  persona_samples JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now()
);
```

**Recomputar:** `POST /api/arena/recompute-profile`

---

## Clusters (24 grupos)

| Range | Macro | Nomes |
|-------|-------|-------|
| P1-P6 | Progressista | Base Social, Trabalhista, Progressista Urbano, Regulador Tecnico, Desenvolvimentista, Centro-Esquerda |
| M1-M8 | Moderado | Centro Economico, Centro Conservador, Institucional, Gestor Pragmatico, Volatil, Empreendedor, Classe Media, Cetico |
| C1-C8 | Conservador | Liberal Mercado, Conservador Religioso, Nacionalista, Linha Dura, Antissistema, Pequeno Empresario, Direita Digital, Conservador Tradicional |
| T1-T2 | Transversal | Desengajado, Anti-Incumbente |

---

## SSE Events (contrato frontend<>backend)

```
route → phase → log → personas_loaded → pre_classified → progress (multiplos) → results → points_chunk → done
```

---

## Arquivos do Sistema

### Backend Python (scripts/arena_analysis/)

| Arquivo | Funcao | Modelo |
|---------|--------|--------|
| `main.py` | FastAPI, orquestra pipeline, SSE | — |
| `aggregate_builder.py` | Pre-computa perfil estatistico | — |
| `aggregate_engine.py` | 1 chamada GPT-4o para derivar scores | GPT-4o |
| `aggregate_prompt.py` | System prompt + schema JSON | — |
| `config.py` | Env vars centralizadas | — |
| `persona_loader.py` | Carrega 20k personas (cached) | — |
| `persona_loop.py` | Loop individual (LEGACY: electoral/calibration) | GPT-4o-mini |
| `results_aggregator.py` | Agrega resultados por segmento | — |
| `comment_prompt.py` | ARENA_SYSTEM_PROMPT (14 regras) | — |
| `pre_classifier.py` | Desambiguacao semantica | GPT-4o-mini |
| `context_builder.py` | Contexto factual + ideological frame | Claude Haiku |
| `web_researcher.py` | Busca web (Tavily) | — |
| `Dockerfile` | Python 3.12-slim + PYTHONUNBUFFERED | — |

### Frontend (src/app/arena/)

| Arquivo | Funcao |
|---------|--------|
| `page.tsx` | PWA principal |
| `store.ts` | Zustand + SSE |
| `types.ts` | Types (ArenaLiveData, AnaliseData) |
| `components/AnalysisSummary.tsx` | Recomendacoes da Duda |
| `components/AnalysisProgressLoader.tsx` | Animacao 6 stages |

### API Next.js

| Arquivo | Funcao |
|---------|--------|
| `src/app/api/arena/analyze/route.ts` | Proxy SSE → Python |
| `src/app/api/arena/analise/route.ts` | Duda (Claude Opus) |

---

## Endpoints

| Metodo | Endpoint | Funcao |
|--------|----------|--------|
| POST | `/api/arena/analyze` | Analise principal (SSE) |
| POST | `/api/arena/analise` | Duda recomendacoes |
| POST | `/api/arena/recompute-profile` | Recomputar perfil |
| GET | `/api/arena/health` | Health check |
| POST | `/api/arena/electoral` | Simulacao eleitoral |

---

## Custos

| Metrica | v2 (20k loop) | v3 (Aggregate) |
|---------|---------------|----------------|
| Chamadas | ~20.000 | 1-2 |
| Custo | $5.46 | $0.12 |
| Economia | — | 98% |
| Tempo UX | 5-7 min | ~90 seg |

---

## Detalhes Tecnicos

- **Startup non-blocking:** pre-warm em `asyncio.create_task()`, health check responde imediato
- **Lazy imports:** `aggregate_engine` importado apenas durante analise
- **PersonaLoop legacy:** mantido para electoral_engine e calibration_endpoint
- **PYTHONUNBUFFERED=1:** logs aparecem imediatamente no DO
- **Dockerfile:** `python -u -m uvicorn` garante stdout nao-bufferizado
