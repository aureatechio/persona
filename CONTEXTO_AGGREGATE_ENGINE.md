# Contexto: Aggregate Engine + Duda Marqueteira

## O que foi feito

Duas mudancas estruturais no pipeline de analise da Arena:

### 1. Aggregate Engine (substitui o loop de 20k personas)

**Antes:** O sistema fazia 20.000 chamadas individuais ao GPT-4o-mini (1 por persona), custando ~$5.46/analise e levando 5-7 minutos.

**Agora:** O sistema pre-computa um "sentimento geral" estatistico das 20k personas (distribuicoes demograficas, eleitorais, ideologicas, opinioes tematicas por cluster) e faz **1 unica chamada ao GPT-4o** que DERIVA os scores 0-10 por segmento a partir desses dados. Custo: ~$0.12/analise (98% economia). Tempo real: ~20-30s.

**Como funciona:**
1. `aggregate_builder.py` pre-computa o perfil estatistico das 20k personas e salva na tabela `arena_sentiment_profile` no Supabase
2. Quando o usuario faz uma analise, `aggregate_engine.py` carrega esse perfil e envia junto com o conteudo do politico para o GPT-4o
3. O modelo NAO faz perguntas — ele DEDUZ logicamente os scores: "se 78% dos evangelicos sao contra aborto e o conteudo defende aborto, score ~2.5 para esse segmento"
4. O frontend continua com as mesmas animacoes (progress bar avancando por ~60 segundos, simulando processamento das 20k personas)
5. Comentarios sao gerados a partir de ~200 personas representativas amostradas estratificadamente (8-10 por cluster)

**Tabela Supabase:** `arena_sentiment_profile`
- id: 'default'
- total_personas: 20000
- demographics, electoral, ideological, clusters, thematic_opinions, geographic, cross_tabulations: JSONB com distribuicoes
- persona_samples: JSONB com ~200 personas representativas
- computed_at: timestamp

**Para recomputar o perfil:** `POST /api/arena/recompute-profile` (ou `python -m arena_analysis.aggregate_builder`)

### 2. Duda Marqueteira

**Antes:** As recomendacoes finais (headline, platform summaries, next steps) usavam uma voz generica de CMO.

**Agora:** Usa a persona "Duda" — estrategista de marketing politico com 20 anos de experiencia. Fala diretamente ao politico em 2a pessoa:
- "Voce precisa entender que os evangelicos sao 35% da sua base..."
- "Se voce postar isso no TikTok sem mudar o gancho, vai queimar dinheiro..."
- "Eu ja vi candidato recuperar 12 pontos em 3 semanas fazendo exatamente isso..."

O JSON output (AnaliseData) continua identico — mesma estrutura, mesmos campos, mesmo formato. So muda a voz/tom.

## Arquivos criados

| Arquivo | Descricao |
|---------|-----------|
| `scripts/arena_analysis/aggregate_builder.py` | Pre-computa perfil estatistico das 20k personas |
| `scripts/arena_analysis/aggregate_engine.py` | Motor: 1 chamada GPT-4o, gera pontos ideologicos sinteticos |
| `scripts/arena_analysis/aggregate_prompt.py` | System prompt + schema JSON para inferencia agregada |
| `supabase/migrations/20260401000000_create_arena_sentiment_profile.sql` | Tabela do perfil (ja aplicada no Supabase) |

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `scripts/arena_analysis/main.py` | Step 5: persona_loop → aggregate_engine, progress sintetico 60s, endpoint recompute |
| `scripts/arena_analysis/config.py` | Adicionado `aggregate_model` (gpt-4o), `aggregate_progress_duration` (60s), removido configs de rate limiting |
| `src/app/api/arena/analise/route.ts` | System prompt: CMO generico → Duda marqueteira |

## Arquivos NAO modificados (compatibilidade verificada)

- `src/app/arena/store.ts` — SSE events identicos
- `src/app/arena/types.ts` — interfaces identicas
- `src/app/arena/components/AnalysisProgressLoader.tsx` — time-based, sem mudanca
- `src/app/arena/components/AnalysisSummary.tsx` — consome AnaliseData, sem mudanca
- `scripts/arena_analysis/pre_classifier.py` — roda antes, sem mudanca
- `scripts/arena_analysis/context_builder.py` — roda antes, sem mudanca
- Arena mobile (Expo) — mesma API, sem mudanca

## Pipeline novo (fluxo completo)

```
1. Web Research (Tavily) — sem mudanca
2. Context Builder (Claude contextualiza) — sem mudanca
3. Ideological Frame (Claude mapeia esq/dir) — sem mudanca
4. Pre-Classifier (GPT-4o-mini desambigua) — sem mudanca
5. AGGREGATE ENGINE (NOVO):
   a. Carrega arena_sentiment_profile do Supabase (cached)
   b. Monta prompt com conteudo + perfil estatistico completo
   c. 1 chamada GPT-4o → JSON com scores por segmento
   d. Emite progress sintetico por 60s (animacao do frontend)
   e. Gera pontos ideologicos sinteticos (~800 pontos)
6. Duda (NOVO):
   - /api/arena/analise recebe resultados agregados
   - Claude Opus gera recomendacoes com voz da Duda
   - headline, platform summaries, next steps — tudo prescritivo
```

## Comparacao de custos

| Metrica | Antes (20k loop) | Agora (Aggregate) |
|---------|-------------------|-----------------|
| Chamadas API | ~20.000 | 1-2 |
| Custo/analise | $5.46 | $0.12 |
| Economia | — | 98% |
| Tempo UX | 5-7 min | ~90 seg |

## Proximos passos

1. Rodar `POST /api/arena/recompute-profile` para popular a tabela com o perfil inicial
2. Testar analise no PWA /arena
3. Ajustar prompts se necessario (qualidade dos scores por segmento)
