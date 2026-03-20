"""
AI-powered persona sentiment classifier.

For each batch of personas, sends a structured prompt to GPT-4o-mini
asking it to classify each persona's likely stance on the question,
based on their full demographic/opinion profile.

v3: Uses pre-classifier output for semantic disambiguation instead of
hardcoded word lists and regex patterns.
"""

import json
import openai
from config import OPENAI_API_KEY

_client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Fields to include in persona context (the ones that matter for opinion analysis)
PROFILE_FIELDS = [
    "gender_identity", "age", "region_br", "generation", "social_class",
    "education_level", "macro_religion", "raca_cor", "political_leaning",
    "aprovacao_lula", "q_avaliacao_bolsonaro", "voto_2022", "voto_2026",
    # Temas
    "tema_aborto", "tema_armas", "tema_maconha", "tema_privatizacoes",
    "tema_cotas_raciais", "tema_casamento_gay",
    # Questionnaire
    "q_pena_morte", "q_familia_tradicional", "q_racismo_estrutural",
    "q_meritocracia", "q_religiao_politica", "q_feminismo_bom",
    "q_democracia_importante", "q_intervencao_militar", "q_impeachment_lula",
    "q_mudanca_climatica_real", "q_sus_funciona", "q_vacinas_confiar",
    "q_direitos_lgbt", "q_adocao_homoafetiva", "q_bolsa_familia_bom",
    "q_amazonia_preservar", "q_energia_renovavel", "q_linguagem_neutra",
    "q_genero_biologico", "q_homeschooling", "q_voto_obrigatorio",
    "q_drogas_descriminalizar", "q_maioridade_penal_16", "q_prostituicao_legalizar",
    "q_confianca_stf", "q_confianca_congresso", "q_confianca_imprensa",
    "q_confianca_policia", "q_confianca_exercito", "q_confianca_igreja",
    "q_estado_tamanho", "q_teto_gastos", "q_previdencia_reforma",
    "q_seguranca_prioridade", "q_policia_violenta",
    # Tabu implícito
    "q_ti_sonegaria_imposto", "q_ti_aceitaria_propina", "q_ti_venderia_voto",
    "q_ti_bater_filho_normal", "q_ti_linchamento_apoiaria", "q_ti_tortura_preso_ok",
    # Vivências
    "q_vi_depressao_ansiedade", "q_vi_ja_foi_assaltado", "q_vi_passou_fome",
]


def _build_persona_summary(persona: dict, index: int) -> str:
    """Build a compact text summary of a persona for the prompt."""
    parts = [f"[{index}]"]
    for field in PROFILE_FIELDS:
        val = persona.get(field)
        if val is not None and val != "" and val != "null":
            # Shorten field name for token efficiency
            short = field.replace("q_", "").replace("tema_", "t_").replace("q_vi_", "v_").replace("q_ti_", "ti_")
            parts.append(f"{short}={val}")
    return " | ".join(parts)


def _build_disambiguation(pre_class: dict | None) -> str:
    """
    Build the semantic disambiguation block from the pre-classifier output.
    This replaces ALL hardcoded political framing rules, word lists, and regex patterns.
    """
    if not pre_class or not pre_class.get("classification_guide"):
        return ""

    guide = pre_class["classification_guide"]
    core = pre_class.get("core_position", "")

    lines = [
        "",
        "═══ ANALISE SEMANTICA (gerada por IA — SIGA EXATAMENTE) ═══",
        f'POSICAO EXPRESSA NO TEXTO: {core}',
        "",
        "REGRA DE CLASSIFICACAO:",
        f'- "positive" = {guide.get("positive_means", "Concorda com a posicao expressa")}',
        f'- "negative" = {guide.get("negative_means", "Discorda da posicao expressa")}',
        f'- "neutral" = {guide.get("neutral_means", "Neutro ou sem opiniao formada")}',
    ]

    # Add figure-specific rules — these are the key disambiguation instructions
    for fig in pre_class.get("figures", []):
        name = fig.get("name", "")
        stance = fig.get("stance", "")
        if not name or not stance:
            continue

        if stance == "attack":
            lines.extend([
                "",
                f"FIGURA: {name} — O texto ATACA/CRITICA {name}.",
                f"- Quem APOIA {name} (aprova, votou nele, alinhamento ideologico) → DISCORDA do texto (negative)",
                f"- Quem se OPOE a {name} (desaprova, votou contra, alinhamento oposto) → CONCORDA com o texto (positive)",
            ])
        elif stance == "defense":
            lines.extend([
                "",
                f"FIGURA: {name} — O texto DEFENDE {name}.",
                f"- Quem APOIA {name} → CONCORDA com o texto (positive)",
                f"- Quem se OPOE a {name} → DISCORDA do texto (negative)",
            ])
        elif stance == "neutral_mention":
            lines.extend([
                "",
                f"FIGURA: {name} — Mencionado sem posicao clara de ataque ou defesa.",
            ])

    # Add relevant fields hint if available
    relevant = pre_class.get("relevant_fields", [])
    if relevant:
        lines.extend([
            "",
            f"CAMPOS MAIS RELEVANTES da persona para esta classificacao: {', '.join(relevant[:8])}",
        ])

    lines.append("═══ FIM DA ANALISE SEMANTICA ═══")
    lines.append("")

    return "\n".join(lines)


def classify_batch(
    question: str,
    personas: list[dict],
    context_text: str | None = None,
    pre_class: dict | None = None,
) -> list[str]:
    """
    Classify a batch of personas using GPT-4o-mini.
    Returns a list of sentiments: 'positive', 'negative', or 'neutral'.

    pre_class: Output from pre_classifier.pre_classify() — provides semantic
    disambiguation so the prompt doesn't need hardcoded rules.
    """
    if not personas:
        return []

    persona_texts = []
    for i, p in enumerate(personas):
        persona_texts.append(_build_persona_summary(p, i))

    personas_block = "\n".join(persona_texts)
    count = len(personas)

    # When context_text is the primary content (longer than question), use it as the debate topic
    if context_text and len(context_text) > len(question):
        prompt_header = f'Tema em debate:\n"{context_text[:3000]}"\n'
        if question and question != context_text[:500]:
            prompt_header += f'\nPergunta associada: "{question}"\n'
    else:
        prompt_header = f'Pergunta em debate: "{question}"\n'
        if context_text:
            prompt_header += f'\nContexto adicional: {context_text}\n'

    # Build semantic disambiguation from pre-classifier (replaces hardcoded rules)
    disambiguation = _build_disambiguation(pre_class)

    prompt = f"""Voce e um simulador de opiniao publica brasileira.

{prompt_header}{disambiguation}Abaixo estao {count} personas sinteticas com seus perfis demograficos e opinioes.
Para CADA persona, analise o perfil completo (ideologia, religiao, classe, educacao, respostas anteriores) e determine se ela provavelmente CONCORDA (positive), DISCORDA (negative) ou e NEUTRA (neutral) com a POSICAO EXPRESSA no texto acima.

IMPORTANTE:
- Use o perfil COMPLETO da persona, nao apenas um campo
- Considere correlacoes reais da sociedade brasileira
- O voto em 2022/2026 e um forte preditor de posicoes politicas
- Respostas anteriores a temas similares sao o melhor indicador
- aprovacao_lula alto = APOIA Lula, baixo = DESAPROVA Lula
- avaliacao_bolsonaro alto = APOIA Bolsonaro, baixo = DESAPROVA Bolsonaro

Personas:
{personas_block}

Responda APENAS com um JSON array de {count} strings, na mesma ordem.
Exemplo: ["positive","negative","neutral","positive"]
Sem explicacao, sem markdown, apenas o array JSON."""

    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=count * 15,  # ~15 tokens per classification
        )

        raw = response.choices[0].message.content.strip()

        # Parse JSON array
        # Handle potential markdown wrapping
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        results = json.loads(raw)

        # Validate
        valid = {"positive", "negative", "neutral"}
        return [r if r in valid else "neutral" for r in results[:count]]

    except Exception as e:
        print(f"[Classifier] GPT error: {e}")
        # Fallback: return all neutral
        return ["neutral"] * count
