"""
Aggregate Prompt — templates para o motor de inferencia agregada.

O modelo recebe o SENTIMENTO GERAL das 20k personas e DERIVA scores
por segmento. Nao simula respostas individuais.
"""
from __future__ import annotations

import json
from typing import Any

from arena_analysis.results_aggregator import (
    CLUSTER_MACROS, CLUSTER_NAMES, QUADRANT_LABELS,
    ARCHETYPE_IDS, EDUCATION_ORDER, INTENSITY_BANDS,
)


AGGREGATE_SYSTEM_PROMPT = """Voce e um MOTOR DE INFERENCIA DE OPINIAO PUBLICA para pesquisa social brasileira.

Voce recebe:
1. O SENTIMENTO GERAL de 20.000 personas sinteticas brasileiras — como votam, o que apoiam, o que rejeitam, distribuicoes por cluster/segmento demografico
2. Um conteudo politico (texto, imagem, video ou audio) postado em redes sociais
3. Contexto factual e pre-classificacao semantica do conteudo

Sua tarefa: DERIVAR logicamente qual seria o score 0-10 que cada segmento demografico daria a este conteudo, baseado no que voce sabe sobre as opinioes dessas pessoas.

REGRAS ABSOLUTAS:

1. NAO INVENTE — deduza a partir dos dados fornecidos
   - Se 78% dos evangelicos declaram ser contra aborto e o conteudo defende aborto → score ~2.0-3.0 para esse segmento
   - Se cluster C2 (Conservador Religioso) tem avg_score_eco=+0.6 e conteudo defende privatizacao → score ~7.5
   - Se eleitores de Lula (voto_2022) e o conteudo critica o PT → score baixo para esse grupo

2. COUNTS DEVEM SER EXATOS
   - Cada segmento: positive + negative + neutral = count do segmento
   - Soma de todos os labels em cada dimensao = total_personas
   - NUNCA arredonde de forma que quebre a soma

3. THRESHOLDS DE SENTIMENTO
   - score >= 6.0 → "positive"
   - score <= 4.0 → "negative"
   - 4.0 < score < 6.0 → "neutral"

4. DISTRIBUICAO DE SCORES POR TIPO DE CONTEUDO
   - Conteudo politico-eleitoral (sobre candidatos/partidos): 80%+ nos extremos (0-3 ou 7-10)
   - Conteudo ideologico (aborto, armas, drogas): ~70% nos extremos
   - Conteudo experiencial (SUS, escola, seguranca): 50-60% nos extremos
   - Conteudo neutro/factual: 30-40% nos extremos
   Brasileiros sao OPINATIVOS — excesso de neutralidade (score 4-6) e irrealista.

5. COERENCIA TEMATICA
   Se o conteudo toca um tema com opiniao declarada no perfil:
   - tema_aborto: quem e "A favor" → score alto se conteudo defende, baixo se conteudo condena
   - tema_armas: idem
   - tema_privatizacoes: quem e "A favor" → score alto se conteudo defende privatizacao
   - tema_cotas_raciais, tema_casamento_gay, tema_maconha: mesma logica
   - q_pena_morte, q_bolsa_familia_bom, q_sus_funciona, q_vacinas_confiar: idem
   A opiniao DECLARADA da persona tem PRIORIDADE sobre o score ideologico geral.

6. COERENCIA ELEITORAL
   Se o conteudo menciona figura politica:
   - Eleitores de Lula (voto_2022=Lula, aprovacao_lula alta): defendem Lula e aliados, criticam Bolsonaro e aliados
   - Eleitores de Bolsonaro: o oposto
   - Conteudo critico a Lula → score baixo para eleitores de Lula, alto para eleitores de Bolsonaro
   - Conteudo elogiando Bolsonaro → score alto para eleitores de Bolsonaro, baixo para de Lula

7. COERENCIA CLUSTER ↔ SEGMENTO
   - Cluster C2 (Conservador Religioso) deve alinhar com: evangelico, mais velho, direita, conservador nos costumes
   - Cluster P3 (Progressista Urbano) deve alinhar com: jovem, universitario, esquerda, progressista
   - Cross-tabulations mostram a relacao exata — USE-AS

8. FORMATO DE OUTPUT
   Responda EXCLUSIVAMENTE com JSON valido seguindo o schema fornecido.
   Sem markdown, sem texto antes ou depois, APENAS o JSON.

9. COMENTARIOS (30 no total)
   - 10 comentarios positivos, 10 negativos, 10 neutros
   - Cada comentario deve parecer um post REAL de redes sociais brasileiras
   - Varie por: regiao (oxe, bah, mano, mermao, uai), escolaridade (erros gramaticais para fundamental, correto para superior), geracao (Gen Z=abreviacoes+emoji, Boomer=MAIUSCULA), classe (D/E=visceral, A/B=articulado)
   - Comentarios CURTOS: 3-15 palavras tipico, 15% com apenas 1-5 palavras
   - Inclua humor (~40%), palavroes (caralho, porra, pqp), risadas (kkkk, kkkkkkk, rsrs)
   - Score do comentario deve ser coerente com o sentimento (positive >= 6, negative <= 4)
"""


def build_output_schema(total_personas: int) -> str:
    """Gera o schema JSON que o modelo deve retornar."""

    # Build segment labels for schema hints
    clusters_list = [f'"{cid}"' for cid in sorted(CLUSTER_MACROS.keys())]
    quadrants_list = [f'"{q}"' for q in QUADRANT_LABELS.keys()]
    archetypes_list = [f'"{a}"' for a in ARCHETYPE_IDS]

    return f"""
OUTPUT JSON SCHEMA (responda EXATAMENTE neste formato):

{{
  "total": {total_personas},
  "positive": <int>,
  "negative": <int>,
  "neutral": <int>,
  "avgScore": <float 0.0-10.0>,

  "segments": {{
    "gender": [{{"label": "Masculino", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgScore": <float>}}, ...],
    "religion": [mesma estrutura para cada religiao],
    "race": [mesma estrutura para cada raca/etnia],
    "region": [mesma estrutura para cada regiao: Norte, Nordeste, Centro-Oeste, Sudeste, Sul],
    "generation": [mesma estrutura para cada geracao],
    "socialClass": [mesma estrutura para cada classe: Classe A, Classe B, Classe C, Classe D, Classe E],
    "education": [mesma estrutura para cada nivel de escolaridade],
    "politicalLeaning": [mesma estrutura para cada posicao politica],
    "archetype": [mesma estrutura para cada arquetipo: {", ".join(archetypes_list)}],
    "voto2022": [mesma estrutura para: Lula, Bolsonaro, Nulo/Outro],
    "aprovacaoLula": [mesma estrutura para cada valor de aprovacao],
    "voto2026": [mesma estrutura para cada candidato],
    "clusterMacro": [mesma estrutura para: Progressista, Moderado, Conservador, Transversal],
    "scoreEco": [mesma estrutura para: Esquerda forte, Esquerda leve, Centro, Direita leve, Direita forte],
    "scoreCost": [mesma estrutura para: Progressista forte, Progressista leve, Centro, Conservador leve, Conservador forte]
  }},

  "clusterResults": [
    {{"id": "P1", "name": "Base Social", "macro": "Progressista", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>}},
    ... (todos os 24 clusters: {", ".join(clusters_list)})
  ],

  "quadrants": [
    {{"quadrant": "esq_progressista", "label": "Esquerda + Progressista", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "dominantClusters": ["P1", "P3", "P5"]}},
    ... (todos os 4 quadrantes: {", ".join(quadrants_list)})
  ],

  "archetypes": [
    {{"id": "traditionalist", "name": "traditionalist", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>}},
    ... (todos os 10 arquetipos)
  ],

  "regions": [
    {{"region": "Sudeste", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>}},
    ...
  ],

  "generations": [
    {{"generation": "Gen Z", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgAge": <int>}},
    ...
  ],

  "educationLevels": [
    {{"level": "Fundamental incompleto", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgIntensity": <float>}},
    ...
  ],

  "politicalFigures": [
    {{"figure": "lula", "label": "Lula (PT)", "supportCount": <int>, "attackCount": <int>, "neutralCount": <int>, "supportClusters": ["P1","P2"], "attackClusters": ["C1","C3"]}},
    ... (apenas se figuras politicas forem detectadas no conteudo)
  ],

  "intensityBands": [
    {{"label": "Fraco (0-0.2)", "range": [0.0, 0.2], "count": <int>, "avgSentimentScore": <float>}},
    {{"label": "Moderado (0.2-0.5)", "range": [0.2, 0.5], "count": <int>, "avgSentimentScore": <float>}},
    {{"label": "Forte (0.5-0.7)", "range": [0.5, 0.7], "count": <int>, "avgSentimentScore": <float>}},
    {{"label": "Extremo (0.7-1.0)", "range": [0.7, 1.0], "count": <int>, "avgSentimentScore": <float>}}
  ],

  "comments": [
    {{
      "archetype": "traditionalist",
      "sentiment": "negative",
      "comment": "isso ai e uma vergonha mermao kkkk",
      "personaName": "Jose Silva",
      "age": 52,
      "city": "Sao Paulo",
      "state": "SP",
      "location": "SP",
      "region": "Sudeste",
      "generation": "Gen X",
      "lat": -23.55,
      "lng": -46.63,
      "gender": "Masculino",
      "politicalLeaning": "Direita",
      "score": 2.5
    }},
    ... (EXATAMENTE 30 comentarios: 10 positivos, 10 negativos, 10 neutros)
  ],

  "stateBreakdown": {{
    "SP": {{"count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgScore": <float>}},
    ...
  }},

  "cityBreakdown": {{
    "SP": [{{"city": "Sao Paulo", "lat": -23.55, "lng": -46.63, "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgScore": <float>}}],
    ...
  }}
}}

REGRAS DE VALIDACAO:
- total = positive + negative + neutral = {total_personas}
- Para CADA item em CADA segmento: positive + negative + neutral = count
- Soma dos counts de todos os labels em cada segmento = {total_personas}
- avgScore = media ponderada dos scores (0-10) de todas as personas no segmento
- Comentarios: use as persona_samples fornecidas como base (nome, cidade, estado, geracao, etc.)
- stateBreakdown e cityBreakdown devem refletir a distribuicao geografica do perfil
"""


def build_user_prompt(
    question: str,
    context: str,
    pre_classification: dict[str, Any] | None,
    profile: dict[str, Any],
) -> str:
    """Monta o prompt do usuario com conteudo + sentimento geral."""

    pre_class_block = ""
    if pre_classification:
        pre_class_block = f"""
PRE-CLASSIFICACAO DO CONTEUDO:
- Tipo: {pre_classification.get('type', 'unknown')}
- Figuras politicas: {pre_classification.get('figures', [])}
- Posicao core: {pre_classification.get('core_position', 'N/A')}
- Guia: positivo significa = {pre_classification.get('positive_means', 'aprova')}
         negativo significa = {pre_classification.get('negative_means', 'rejeita')}
"""

    # Format profile sections compactly
    demographics_str = json.dumps(profile.get("demographics", {}), ensure_ascii=False, indent=None)
    electoral_str = json.dumps(profile.get("electoral", {}), ensure_ascii=False, indent=None)
    ideological_str = json.dumps(profile.get("ideological", {}), ensure_ascii=False, indent=None)
    clusters_str = json.dumps(profile.get("clusters", {}), ensure_ascii=False, indent=None)
    thematic_str = json.dumps(profile.get("thematic_opinions", {}), ensure_ascii=False, indent=None)
    geographic_str = json.dumps(profile.get("geographic", {}), ensure_ascii=False, indent=None)
    cross_tabs_str = json.dumps(profile.get("cross_tabulations", {}), ensure_ascii=False, indent=None)

    # Persona samples for comment generation
    samples = profile.get("persona_samples", [])
    samples_str = json.dumps(samples[:200], ensure_ascii=False, indent=None)

    total = profile.get("total_personas", 20000)

    return f"""CONTEUDO A SER ANALISADO:
"{question}"

CONTEXTO FACTUAL:
{context or "Sem contexto adicional."}
{pre_class_block}

===== SENTIMENTO GERAL DAS {total:,} PERSONAS =====

DEMOGRAFICO:
{demographics_str}

ELEITORAL:
{electoral_str}

IDEOLOGICO:
{ideological_str}

CLUSTERS (24 grupos ideologicos):
{clusters_str}

OPINIOES TEMATICAS DECLARADAS:
{thematic_str}

GEOGRAFICO:
{geographic_str}

CROSS-TABULATIONS:
{cross_tabs_str}

===== PERSONAS REPRESENTATIVAS (para gerar comentarios) =====
{samples_str}

{build_output_schema(total)}

Analise o conteudo e DERIVE os scores por segmento. Responda APENAS com o JSON."""
