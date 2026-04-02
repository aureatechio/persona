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

6. COERENCIA CLUSTER ↔ SEGMENTO
   - Cluster C2 (Conservador Religioso) deve alinhar com: evangelico, mais velho, direita, conservador nos costumes
   - Cluster P3 (Progressista Urbano) deve alinhar com: jovem, universitario, esquerda, progressista
   - Cross-tabulations mostram a relacao exata — USE-AS

7. FORMATO DE OUTPUT
   Responda EXCLUSIVAMENTE com JSON valido seguindo o schema fornecido.
   Sem markdown, sem texto antes ou depois, APENAS o JSON.

8. COMENTARIOS (9 no total)
   - 3 positivos, 3 negativos, 3 neutros
   - Posts CURTOS de redes sociais (3-10 palavras)
   - Varie regiao e geracao. Score: positive >= 6, negative <= 4
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
    ... (EXATAMENTE 9 comentarios: 3 positivos, 3 negativos, 3 neutros)
  ]
}}

NAO inclua stateBreakdown nem cityBreakdown no JSON — sao gerados separadamente.

REGRAS DE VALIDACAO:
- total = positive + negative + neutral = {total_personas}
- Para CADA item em CADA segmento: positive + negative + neutral = count
- Soma dos counts de todos os labels em cada segmento = {total_personas}
- Comentarios: use as persona_samples como base (nome, cidade, estado, geracao)
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

    # ── Compact profile to reduce tokens (~56K → ~8K) ──

    # Demographics: just label→count
    def _compact_demo(data: dict) -> str:
        lines = []
        for category, items in data.items():
            if isinstance(items, dict):
                parts = [f"{k}:{v}" for k, v in items.items() if v]
                lines.append(f"  {category}: {', '.join(parts)}")
        return "\n".join(lines) if lines else json.dumps(data, ensure_ascii=False)

    demographics_str = _compact_demo(profile.get("demographics", {}))
    electoral_str = _compact_demo(profile.get("electoral", {}))
    ideological_str = _compact_demo(profile.get("ideological", {}))

    # Thematic: compact
    thematic_str = _compact_demo(profile.get("thematic_opinions", {}))

    # Clusters: 1 line per cluster (id, name, count, avg_eco, avg_cost)
    clusters_data = profile.get("clusters", {})
    cluster_items = clusters_data.get("clusters", clusters_data)
    cluster_lines = []
    if isinstance(cluster_items, dict):
        for cid, cdata in cluster_items.items():
            if isinstance(cdata, dict):
                cluster_lines.append(
                    f"  {cid} ({cdata.get('name', cid)}): n={cdata.get('count', 0)}, eco={cdata.get('avg_score_eco', 0):.2f}, cost={cdata.get('avg_score_cost', 0):.2f}, regiao={cdata.get('dominant_region', '?')}"
                )
    clusters_str = "\n".join(cluster_lines) if cluster_lines else json.dumps(clusters_data, ensure_ascii=False)

    # Geographic: just state→count (1 line)
    geo_data = profile.get("geographic", {})
    states = geo_data.get("states", geo_data)
    if isinstance(states, dict):
        geo_parts = [f"{st}:{d.get('count', d) if isinstance(d, dict) else d}" for st, d in states.items()]
        geographic_str = "  " + ", ".join(geo_parts)
    else:
        geographic_str = json.dumps(geo_data, ensure_ascii=False)

    # Persona samples: only 30 (for comment generation), compact fields
    samples = profile.get("persona_samples", [])
    compact_samples = []
    for s in samples[:30]:
        compact_samples.append({
            "name": s.get("name", ""),
            "age": s.get("age", 0),
            "city": s.get("city", ""),
            "state": s.get("state", ""),
            "gender": s.get("gender", ""),
            "education": s.get("education_level", ""),
            "generation": s.get("generation", ""),
            "political": s.get("political_leaning", ""),
            "cluster": s.get("cluster_id", ""),
            "religion": s.get("macro_religion", ""),
        })
    samples_str = json.dumps(compact_samples, ensure_ascii=False, indent=None)

    total = profile.get("total_personas", 20000)

    return f"""CONTEUDO: "{question}"

CONTEXTO: {context or "Sem contexto adicional."}
{pre_class_block}

=== PERFIL DAS {total:,} PERSONAS ===

DEMOGRAFICO:
{demographics_str}

ELEITORAL:
{electoral_str}

IDEOLOGICO:
{ideological_str}

CLUSTERS:
{clusters_str}

OPINIOES TEMATICAS:
{thematic_str}

ESTADOS (count por UF):
{geographic_str}

=== PERSONAS PARA COMENTARIOS (30) ===
{samples_str}

{build_output_schema(total)}

DERIVE os scores e responda APENAS com JSON."""
