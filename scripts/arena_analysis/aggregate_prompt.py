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
    """Schema JSON MINIMO — Python expande os segmentos restantes."""

    return f"""
OUTPUT JSON — responda APENAS com este formato COMPACTO:

{{
  "total": {total_personas},
  "positive": <int>,
  "negative": <int>,
  "neutral": <int>,
  "avgScore": <float 0-10>,
  "segments": {{
    "gender": [{{"label": "Masculino", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgScore": <float>}}, {{"label": "Feminino", ...}}],
    "religion": [{{"label": "<religiao>", "count": <int>, "positive": <int>, "negative": <int>, "neutral": <int>, "avgScore": <float>}}, ...],
    "region": [{{"label": "<regiao>", ...}}, ...],
    "generation": [{{"label": "<geracao>", ...}}, ...],
    "politicalLeaning": [{{"label": "<posicao>", ...}}, ...],
    "voto2022": [{{"label": "Lula", ...}}, {{"label": "Bolsonaro", ...}}, {{"label": "Nulo/Outro", ...}}]
  }},
  "comments": [
    {{"sentiment": "positive|negative|neutral", "comment": "texto curto", "personaName": "Nome", "age": 30, "city": "Cidade", "state": "UF", "region": "Regiao", "generation": "Gen X", "gender": "Masculino", "politicalLeaning": "Direita", "score": 7.5}},
    ... (9 comentarios: 3 positivos, 3 negativos, 3 neutros)
  ]
}}

REGRAS:
- total = positive + negative + neutral = {total_personas}
- Para cada segmento: positive + negative + neutral = count
- Inclua APENAS os 6 segmentos acima (gender, religion, region, generation, politicalLeaning, voto2022)
- Os demais segmentos sao gerados pelo sistema automaticamente
- Comentarios CURTOS (3-10 palavras), com girias regionais
"""


def build_user_prompt(
    question: str,
    context: str,
    pre_classification: dict[str, Any] | None,
    profile: dict[str, Any],
) -> str:
    """Monta o prompt do usuario com conteudo + sentimento geral."""

    # Use core_position as the primary content when available — it captures the
    # actual political meaning from transcript/visual analysis. The user's question
    # may be operational ("seria um bom video?") rather than the actual content.
    core_position = ""
    pre_class_block = ""
    if pre_classification:
        core_position = pre_classification.get("core_position", "") or ""
        guide = pre_classification.get("classification_guide", {})
        pre_class_block = f"""
PRE-CLASSIFICACAO DO CONTEUDO:
- Tipo: {pre_classification.get('type', 'unknown')}
- Figuras politicas: {pre_classification.get('figures', [])}
- Posicao core: {core_position or 'N/A'}
- Guia: positivo significa = {guide.get('positive_means', pre_classification.get('positive_means', 'aprova'))}
         negativo significa = {guide.get('negative_means', pre_classification.get('negative_means', 'rejeita'))}
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

    # Primary content: core_position (political meaning) > question (user text)
    primary_content = core_position or question
    # If core_position differs from question, include original question as context
    user_note = ""
    if core_position and question and core_position.lower() != question.lower():
        user_note = f'\nNOTA DO USUARIO: "{question}"'

    return f"""CONTEUDO: "{primary_content}"{user_note}

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
