# Guia Tecnico Completo — Arena Analysis Python Backend

> Documento para outros agentes/desenvolvedores saberem exatamente onde mexer em cada parte do sistema.

---

## Visao Geral do Pipeline

```
Usuario envia conteudo (texto/imagem/video)
    |
[1] Visual Analysis (GPT-4o vision) — se imagem/video
[2] Web Research (Tavily) — Claude Haiku decide se precisa buscar
[3] Context Builder (Claude Haiku) — gera contexto factual
[4] Ideological Frame (Claude Haiku) — mapeia visao esquerda vs direita
[5] Pre-Classifier (GPT-4o-mini) — desambigua concordar/discordar
[6] Persona Loading (Supabase) — carrega 20k personas
[7] Geo Filter — filtra por estado/cidade se solicitado
    |
[8] AGGREGATE ENGINE (GPT-4o) — 1 chamada, deriva scores por segmento
[9] Python expande segmentos faltantes + aplica polarizacao politica + gera geo
[10] Gera pontos ideologicos (~800 pontos sinteticos)
    |
[11] DUDA ANALYZER (Claude Sonnet) — recomendacoes estrategicas
[12] Specialist Worker (5x Claude Haiku em paralelo) — pareceres tecnicos
    |
Resultado final via SSE → Frontend
```

---

## Arquivos e Onde Mexer

### scripts/arena_analysis/config.py

Configuracao centralizada. **Tudo que e modelo, token, key esta aqui.**

| Setting | Valor Atual | Linha | O que faz |
|---------|-------------|-------|-----------|
| `aggregate_model` | `"gpt-4o"` | 94 | Modelo do motor de inferencia (scores por segmento) |
| `aggregate_max_tokens` | `4000` | 95 | Max tokens de OUTPUT do aggregate |
| `smart_model` | `"claude-haiku-4-5-20251001"` | 60 | Modelo para context builder e ideological frame |
| `openai_model` | `"gpt-4o-mini"` | 69 | Modelo para pre-classifier |
| `vision_model` | `"gpt-4o"` | 98 | Modelo para analise visual (imagens) |
| `vision_max_tokens` | `2500` | 99 | Max tokens da analise visual |
| `persona_cache_ttl` | `300` | 88 | Cache de personas em segundos (5 min) |
| `max_retries` | `2` | 103 | Retentativas em erro de API |

**Para trocar o modelo do aggregate engine:** mude `aggregate_model` na linha 94.
**Para trocar o modelo da analise visual:** mude `vision_model` na linha 98.

### scripts/arena_analysis/main.py

Orquestrador principal. FastAPI + SSE streaming.

**Endpoints:**

| Metodo | Rota | Funcao | Linha |
|--------|------|--------|-------|
| GET | `/api/arena/health` | Health check | ~123 |
| POST | `/api/arena/analyze` | Pipeline principal (SSE) | ~155 |
| POST | `/api/arena/recompute-profile` | Recomputa perfil agregado | ~670 |
| POST | `/api/duda/analyze` | Duda standalone (backward-compat) | ~684 |
| POST | `/api/arena/electoral` | Simulacao eleitoral | ~731 |
| POST | `/api/calibracao/analyze` | Debug/calibracao | ~725 |

**Fluxo do `/api/arena/analyze` (linha ~155):**

```
Step 0: Watch disconnect (linha ~162)
Step 1: Visual analysis se imagem (linha ~203)
       → from arena_analysis.visual_analyzer import analyze_image
       → Modelo: settings.vision_model (gpt-4o)
       → Retorna: content_analysis, visual_structure, core_point, political_figures

Step 2: Pre-classify em paralelo (linha ~183)
       → from arena_analysis.pre_classifier import pre_classify
       → Modelo: gpt-4o-mini, max_tokens=800, temperature=0

Step 3: Web research + Context builder (linha ~251)
       → context_builder.smart_search() — Claude Haiku decide se busca
       → context_builder.build() — Claude Haiku gera contexto
       → Retorna: ContextResult(tema, contexto, figuras, periodo)

Step 4: Ideological frame (linha ~343)
       → context_builder.build_ideological_frame()
       → Retorna: texto com visao_direita e visao_esquerda

Step 5: Carregar personas (linha ~322, paralelo com step 3)
       → persona_loader.load_personas()
       → 20k personas do Supabase (cached 5 min)

Step 6: Geo filter (linha ~326)
       → apply_geo_filter(personas, request.geo_filter)

Step 7: AGGREGATE ENGINE (linha ~444)
       → aggregate_engine.analyze()
       → Modelo: settings.aggregate_model (gpt-4o)
       → Max tokens: settings.aggregate_max_tokens (4000)
       → Temperature: 0.7
       → Input: perfil compacto + question + context + pre_classification
       → Output: JSON com total, positive, negative, neutral, segments (6), comments (9)
       → Python expande: segmentos faltantes, clusters, quadrants, archetypes
       → Python aplica: polarizacao politica (direita/esquerda)
       → Python gera: stateBreakdown (27 estados), cityBreakdown (100 cidades)

Step 8: Progress sintetico (linha ~487)
       → 20 steps de ~3s cada com fake data incremental
       → Envia segments fake a cada 4 steps para dashboard animar

Step 9: Pontos ideologicos (linha ~586)
       → generate_ideological_points()
       → ~800 pontos sinteticos para scatter plot

Step 10: DUDA ANALYZER (linha ~620)
        → duda_analyzer.analyze_duda()
        → Chama specialist-worker primeiro (5 especialistas em paralelo)
        → Depois Claude Sonnet com pareceres dos especialistas
        → Retorna: headline, platformSummaries, recommendations, etc.
```

### scripts/arena_analysis/aggregate_engine.py

Motor principal de inferencia. **Aqui e onde os scores por segmento sao gerados.**

**Funcoes principais:**

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `load_profile()` | ~32 | Carrega perfil agregado do Supabase (cache 10 min) |
| `analyze()` | ~66 | Funcao principal — chama GPT-4o e processa resultado |
| `_expand_segments_from_profile()` | ~404 | Gera segmentos faltantes (race, socialClass, education, scoreEco, scoreCost, clusterMacro, archetype, clusters, quadrants, archetypes, regions, generations, educationLevels, intensityBands) |
| `_detect_ideological_lean()` | ~219 | Detecta se conteudo e de direita/esquerda/consenso/neutro |
| `_bias_segment_scores()` | ~251 | Ajusta scores de 1 segmento baseado no lean |
| `_bias_cluster_results()` | ~311 | Ajusta clusters baseado no lean |
| `_apply_political_bias()` | ~344 | Aplica polarizacao completa (segments + clusters + quadrants + global) |
| `_enrich_geo_from_profile()` | ~573 | Gera stateBreakdown e cityBreakdown com vies regional |
| `generate_ideological_points()` | ~671 | Gera pontos sinteticos para scatter plot |

**Para mudar como a polarizacao funciona:**

1. Keywords de direita: `_RIGHT_KEYWORDS` (linha ~187)
2. Keywords de esquerda: `_LEFT_KEYWORDS` (linha ~196)
3. Keywords de consenso: `_CONSENSUS_KEYWORDS` (linha ~204)
4. Lean por estado: `_STATE_POLITICAL_LEAN` (linha ~558)
5. Proporcoes de bias: `_bias_segment_scores()` (linha ~251)
   - Aligned: 70-85% positive (linha ~299)
   - Opposed: 65-80% negative (linha ~305)
   - Consensus: 65% positive (linha ~294)

**Para mudar quais segmentos o GPT gera vs Python expande:**

O GPT gera apenas 6 segmentos (definidos em `aggregate_prompt.py` → `build_output_schema()`):
- gender, religion, region, generation, politicalLeaning, voto2022

O Python expande o resto em `_expand_segments_from_profile()`:
- race, socialClass, education, scoreEco, scoreCost, aprovacaoLula, voto2026, clusterMacro, archetype

**Para adicionar um novo segmento ao GPT:** edite `build_output_schema()` em `aggregate_prompt.py`.
**Para adicionar um novo segmento ao Python:** edite `_expand_segments_from_profile()` em `aggregate_engine.py`.

### scripts/arena_analysis/aggregate_prompt.py

Prompts que o GPT-4o recebe. **Aqui e onde voce muda as regras de inferencia.**

| Constante/Funcao | Linha | O que faz |
|-------------------|-------|-----------|
| `AGGREGATE_SYSTEM_PROMPT` | ~18 | System prompt com 8 regras de inferencia |
| `build_output_schema()` | ~76 | Schema JSON que o GPT deve retornar |
| `build_user_prompt()` | ~111 | Monta o prompt com question + perfil compacto |

**Regras atuais no system prompt:**

1. NAO INVENTE — deduza dos dados
2. COUNTS EXATOS — positive + negative + neutral = count
3. THRESHOLDS — score >= 6.0 positive, <= 4.0 negative
4. DISTRIBUICAO — politico 80% extremos, ideologico 70%, experiencial 50%
5. COERENCIA TEMATICA — respeitar opiniao declarada (tema_aborto, tema_armas, etc)
6. COERENCIA CLUSTER — C2 alinha com evangelico/direita, P3 com jovem/esquerda
7. FORMATO — JSON valido, sem markdown
8. COMENTARIOS — 9 total (3 pos, 3 neg, 3 neu), curtos, regionais

**Para mudar as regras de como scores sao derivados:** edite `AGGREGATE_SYSTEM_PROMPT` (linha ~18).
**Para mudar o formato de output:** edite `build_output_schema()` (linha ~76).
**Para mudar quais dados do perfil o GPT recebe:** edite `build_user_prompt()` (linha ~111).

### scripts/arena_analysis/aggregate_builder.py

Pre-computa o perfil estatistico das 20k personas. **Roda 1x quando personas mudam.**

| Funcao | O que computa |
|--------|--------------|
| `_build_demographics()` | gender, religion, race, generation, education, social_class — count por label |
| `_build_electoral()` | voto_2022 (normalizado Lula/Bolsonaro/Nulo), aprovacao_lula, voto_2026, avaliacao_bolsonaro |
| `_build_ideological()` | score_economico e score_costumes em 5 buckets, political_leaning, quadrantes |
| `_build_clusters()` | Por cluster: count, avg_score_eco, avg_score_cost, dominant_region/generation/education + archetypes |
| `_build_thematic_opinions()` | tema_aborto, armas, maconha, privatizacoes, cotas, casamento_gay + 8 campos q_ |
| `_build_geographic()` | Por estado: count, avg scores. Top 100 cidades com lat/lng |
| `_build_cross_tabulations()` | cluster x regiao, geracao x political_leaning, voto x classe |
| `_build_persona_samples()` | ~200 personas representativas (8-10 por cluster, diversas) |

**Para recomputar:** `POST /api/arena/recompute-profile`
**Ou standalone:** `python -m arena_analysis.aggregate_builder`

**Tabela Supabase:** `arena_sentiment_profile` (id='default')

### scripts/arena_analysis/duda_analyzer.py

Analise estrategica da Duda (marqueteira politica). **688 linhas.**

| Parte | Linha | O que faz |
|-------|-------|-----------|
| `PLATFORM_KNOWLEDGE` | ~28 | Regras por plataforma (Instagram, YouTube, TikTok, TV, Radio, Outdoor, Impresso, X) |
| System prompt da Duda | ~348 | Personalidade, tom, regras de linguagem, formato JSON |
| `analyze_duda()` | ~258 | Funcao principal |
| Chamada Claude | ~658 | `model="claude-sonnet-4-20250514"`, max_tokens=2000 |
| Specialist block | ~610 | Injeta pareceres dos 5 especialistas no prompt |

**Para mudar o modelo da Duda:** linha ~659 (`model=...`)
**Para mudar max_tokens da Duda:** linha ~660 (`max_tokens=...`)
**Para mudar a personalidade da Duda:** edite o system prompt a partir da linha ~348
**Para mudar as regras por plataforma:** edite `PLATFORM_KNOWLEDGE` a partir da linha ~28

**Output da Duda (JSON):**

```json
{
  "headline": "Frase curta (max 12 palavras)",
  "platformSummaries": [{"platform": "instagram", "summary": "2 frases (max 150 chars)"}],
  "summary": "Resumo direto (max 120 chars)",
  "dashboardHighlights": [{"segmentName": "...", "type": "high_approval|high_rejection|high_neutrality", "percentage": 90, "description": "..."}],
  "score": 6.5,
  "tags": ["plataforma · regiao", "tipo · tema"],
  "stats": [{"value": "+XX%", "label": "descricao"}],
  "recommendations": [{"icon": "...", "text": "...", "gain": "+XX%...", "priority": "...", "detail": "texto pronto copiavel"}],
  "projectedScore": 8.5,
  "insight": {"title": "...", "description": "max 80 chars", "action": "..."},
  "nextSteps": [{"title": "...", "benefit": "...", "deadline": "hoje|amanha|essa semana"}],
  "radar": {"alcance": 7.5, "engajamento": 6.0, "retencao": 5.5, "conversao": 4.0, "adequacao": 8.0, "emocional": 6.5},
  "specialistPanel": {"consensus": "...", "divergences": "...", "specialists": [...]}
}
```

### scripts/arena_analysis/pre_classifier.py

Classifica semanticamente a pergunta/conteudo. **GPT-4o-mini.**

| Parte | Linha | O que faz |
|-------|-------|-----------|
| `SYSTEM_PROMPT` | ~18 | Prompt de classificacao |
| `pre_classify()` | ~100 | Funcao principal — chama GPT-4o-mini |
| `build_disambiguation_block()` | ~154 | Gera bloco de desambiguacao injetado no prompt |

**Output:**
```json
{
  "type": "political_figure | policy_topic | moral_extreme | factual | mixed | other",
  "figures": [{"name": "Lula", "stance": "attack|defense|neutral_mention", "confidence": 0.95}],
  "core_position": "Frase descrevendo a posicao expressa",
  "classification_guide": {
    "positive_means": "concordar com X",
    "negative_means": "discordar de X",
    "neutral_means": "indiferente"
  }
}
```

**Para mudar o modelo:** linha ~116 (`model="gpt-4o-mini"`)

### scripts/arena_analysis/context_builder.py

Cria contexto factual e frame ideologico. **Claude Haiku.**

| Funcao | O que faz | Modelo |
|--------|-----------|--------|
| `smart_search()` | Claude decide se precisa buscar na web. Se sim, Tavily busca | Claude Haiku |
| `build()` | Gera contexto: tema, contexto, figuras, periodo | Claude Haiku |
| `build_ideological_frame()` | Mapeia visao esquerda vs direita | Claude Haiku |

**Para mudar o modelo:** `config.py` linha 60 (`smart_model`)

### scripts/arena_analysis/persona_loader.py

Carrega 20k personas do Supabase. Cache em memoria.

- **Tabela:** `personas` (20k rows, 104+ campos)
- **Cache TTL:** `config.py` → `persona_cache_ttl` (300s = 5 min)
- **Batch loading:** 1000 por request (limite Supabase)
- **Campos carregados:** 104 campos definidos em `PERSONA_FIELDS` (linha ~31)

### scripts/arena_analysis/results_aggregator.py

Constantes de clusters, quadrantes, arquetipos. Funcao `aggregate_results()` (usada pelo pipeline legado).

**Constantes importantes:**

| Constante | Linha | Descricao |
|-----------|-------|-----------|
| `CLUSTER_MACROS` | ~18 | Mapeamento cluster → macro (P1→Progressista, M1→Moderado, C1→Conservador, T1→Transversal) |
| `CLUSTER_NAMES` | ~29 | Nomes dos 24 clusters (P1→Base Social, C2→Conservador Religioso, etc) |
| `QUADRANT_LABELS` | ~47 | 4 quadrantes ideologicos |
| `ARCHETYPE_IDS` | ~42 | 10 arquetipos (traditionalist, activist, analyst, moderate, entrepreneur, pragmatist, idealist, skeptic, religious, youth) |
| `EDUCATION_ORDER` | ~54 | Ordem de escolaridade |
| `INTENSITY_BANDS` | ~61 | 4 faixas de intensidade (Fraco, Moderado, Forte, Extremo) |

**Para adicionar/remover clusters:** edite `CLUSTER_MACROS` e `CLUSTER_NAMES`.

### specialist-worker/

Worker separado com 5 consultores especializados. Roda no mesmo app DO.

**Arquivos:**

| Arquivo | O que faz |
|---------|-----------|
| `server.py` | FastAPI na porta 3011, endpoint `/analyze` |
| `specialists.py` | Definicao dos 5 especialistas + context builder |
| `config.py` | Modelo: `claude-haiku-4-5-20251001`, max_tokens: 800 |

**Os 5 especialistas:**

| ID | Nome | Prompt Supabase |
|----|------|-----------------|
| `comunicacao_politica` | Comunicacao Politica | `specialist_comunicacao_politica` |
| `assuntos_religiosos` | Assuntos Religiosos | `specialist_assuntos_religiosos` |
| `marketing_digital` | Marketing Digital | `specialist_marketing_digital` |
| `psicologia_social` | Psicologia Social | `specialist_psicologia_social` |
| `compliance_legal` | Compliance Legal | `specialist_compliance_legal` |

**Prompts:** Carregados da tabela `arena_prompts` no Supabase (hot-reloadable, cache 5 min).
**Para mudar os prompts:** edite na tabela `arena_prompts` no Supabase — sem redeploy.
**Para mudar o modelo dos especialistas:** `specialist-worker/config.py` linha 16.

**Output de cada especialista:**
```json
{
  "verdict": "Frase direta (max 60 chars)",
  "riskLevel": "baixo|medio|alto|critico",
  "keyPoints": ["Ponto 1", "Ponto 2"],
  "recommendations": [{"text": "Acao", "priority": "urgente|importante|oportunidade", "segment": "Publico"}],
  "dataHighlight": "Dado curioso (opcional)"
}
```

---

## Resumo de Modelos e Onde Trocar

| Etapa | Modelo Atual | Onde Trocar | Arquivo |
|-------|-------------|-------------|---------|
| Analise visual (imagem) | gpt-4o | `config.py` linha 98 | `vision_model` |
| Smart search (decidir busca) | claude-haiku-4-5 | `config.py` linha 60 | `smart_model` |
| Context builder | claude-haiku-4-5 | `config.py` linha 60 | `smart_model` |
| Ideological frame | claude-haiku-4-5 | `config.py` linha 60 | `smart_model` |
| Pre-classifier | gpt-4o-mini | `pre_classifier.py` linha ~116 | hardcoded |
| **Aggregate engine** | **gpt-4o** | **`config.py` linha 94** | **`aggregate_model`** |
| **Duda analyzer** | **claude-sonnet-4** | **`duda_analyzer.py` linha ~659** | **hardcoded** |
| Especialistas (5x) | claude-haiku-4-5 | `specialist-worker/config.py` linha 16 | `SPECIALIST_MODEL` |

---

## Resumo de Dados e Onde Vem

| Dado no Dashboard | Quem Gera | Onde Mudar |
|-------------------|-----------|------------|
| Score geral (0-10) | GPT-4o (aggregate) | `aggregate_prompt.py` → regras |
| Segmentos (gender, religion, region, generation, politicalLeaning, voto2022) | GPT-4o | `aggregate_prompt.py` → `build_output_schema()` |
| Segmentos expandidos (race, socialClass, education, scoreEco, scoreCost, etc) | Python | `aggregate_engine.py` → `_expand_segments_from_profile()` |
| Clusters (P1-P6, M1-M8, C1-C8, T1-T2) | Python | `aggregate_engine.py` → `_expand_segments_from_profile()` |
| Quadrantes ideologicos | Python | `aggregate_engine.py` → `_expand_segments_from_profile()` |
| Polarizacao (esquerda vs direita) | Python | `aggregate_engine.py` → `_apply_political_bias()` |
| Mapa (stateBreakdown, cityBreakdown) | Python | `aggregate_engine.py` → `_enrich_geo_from_profile()` |
| Vies regional no mapa | Python | `aggregate_engine.py` → `_STATE_POLITICAL_LEAN` |
| Comentarios (9) | GPT-4o | `aggregate_prompt.py` → regra 8 |
| Pontos ideologicos (scatter) | Python | `aggregate_engine.py` → `generate_ideological_points()` |
| Headline da Duda | Claude Sonnet | `duda_analyzer.py` → system prompt |
| Platform summaries | Claude Sonnet | `duda_analyzer.py` → system prompt |
| Recommendations | Claude Sonnet | `duda_analyzer.py` → system prompt |
| Specialist panel | 5x Claude Haiku | `specialist-worker/` → prompts no Supabase |

---

## Tabelas Supabase

| Tabela | O que armazena | Quem usa |
|--------|----------------|----------|
| `personas` | 20k personas (120+ campos cada) | `persona_loader.py`, `aggregate_builder.py` |
| `arena_sentiment_profile` | Perfil estatistico pre-computado (JSONB) | `aggregate_engine.py` |
| `arena_prompts` | Prompts hot-reloadable (specialist prompts, arena_system) | `specialist-worker/`, `comment_prompt.py` |

---

## Deploy

- **Backend Python:** Digital Ocean App Platform, auto-deploy on push to main
- **Specialist Worker:** Mesmo app DO, service separado na porta 3011, rota `/specialists`
- **Frontend Next.js:** Vercel, auto-deploy on push to main
- **Dockerfile:** `scripts/arena_analysis/Dockerfile` — Python 3.12-slim + ffmpeg + PYTHONUNBUFFERED=1
