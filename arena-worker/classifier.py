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

# ALL persona fields — since we now do 1 persona per call, we send the COMPLETE
# profile instead of a curated subset. Every column matters equally for analysis.
PROFILE_FIELDS = [
    # Demographics
    "gender_identity", "age", "region_br", "state", "generation", "social_class",
    "education_level", "macro_religion", "religiao_subtipo", "raca_cor",
    "political_leaning", "civil_status", "area_type",
    # Ideological 2D
    "cluster_id", "nome_grupo", "score_economico", "score_costumes",
    # Electoral
    "aprovacao_lula", "q_avaliacao_bolsonaro", "voto_2022", "voto_2026",
    "q_politico_favorito",
    # Temas
    "tema_aborto", "tema_armas", "tema_maconha", "tema_privatizacoes",
    "tema_cotas_raciais", "tema_casamento_gay",
    # Extra profile
    "recebe_beneficio", "usa_transporte_publico", "time_futebol",
    # Questionnaire — ALL fields
    "q_maior_problema", "q_situacao_economica", "q_perspectiva_futuro",
    "q_midia_principal", "q_voto_influenciado_por",
    "q_pena_morte", "q_prisao_perpetua", "q_maioridade_penal_16",
    "q_policia_violenta", "q_crack_internar_forcado",
    "q_seguranca_prioridade", "q_camera_facial_aceita", "q_justica_funciona",
    "q_drogas_descriminalizar",
    "q_familia_tradicional", "q_feminismo_bom", "q_racismo_estrutural",
    "q_meritocracia", "q_genero_biologico", "q_linguagem_neutra",
    "q_ideologia_genero_escola", "q_adocao_homoafetiva", "q_direitos_lgbt",
    "q_mulher_presidente", "q_divorcio_facilitar", "q_religiao_politica",
    "q_prostituicao_legalizar", "q_poligamia", "q_aborto_estupro",
    "q_salario_minimo_aumentar", "q_reforma_tributaria", "q_imposto_ricos",
    "q_estado_tamanho", "q_bolsa_familia_bom", "q_auxilio_emergencial_voltar",
    "q_desemprego_principal", "q_inflacao_controle", "q_bitcoin_confiar",
    "q_banco_central_independente", "q_teto_gastos", "q_previdencia_reforma",
    "q_13_salario_manter",
    "q_impeachment_lula", "q_intervencao_militar",
    "q_corrupcao_problema", "q_democracia_importante", "q_reeleicao",
    "q_voto_obrigatorio", "q_fake_news_problema", "q_redes_sociais_censuradas",
    "q_sistema_eleitoral_confiavel", "q_pt_comunista", "q_bolsonaro_ditador",
    "q_mudanca_climatica_real", "q_amazonia_preservar", "q_agronegocio_desmata",
    "q_energia_renovavel", "q_queimadas_criminosas",
    "q_vacinas_confiar", "q_ciencia_importante", "q_terra_plana",
    "q_sus_funciona", "q_medicina_publica_boa", "q_plano_saude_tem",
    "q_universidade_publica_gratuita", "q_homeschooling",
    "q_ensino_distancia", "q_escola_particular_melhor", "q_enem_justo",
    "q_confianca_stf", "q_confianca_congresso", "q_confianca_imprensa",
    "q_confianca_policia", "q_confianca_exercito", "q_confianca_igreja",
    "q_china_ameaca", "q_eua_aliado", "q_imigracao",
    "q_whatsapp_noticias",
    # Tabu Implícito — ALL 20
    "q_ti_racismo_latente", "q_ti_nao_contrataria_negro_chefia",
    "q_ti_vizinho_negro_incomoda", "q_ti_sonegaria_imposto",
    "q_ti_aceitaria_propina", "q_ti_venderia_voto",
    "q_ti_bater_filho_normal", "q_ti_mulher_roupa_culpada",
    "q_ti_homofobia_violenta", "q_ti_linchamento_apoiaria",
    "q_ti_tortura_preso_ok", "q_ti_trabalho_infantil_ok",
    "q_ti_jeitinho_furar_fila", "q_ti_assediaria_mulher_rua",
    "q_ti_intolerancia_religiosa", "q_ti_preconceito_nordestino",
    "q_ti_violencia_domestica", "q_ti_compraria_produto_roubado",
    "q_ti_menor14_sabe_o_que_faz", "q_ti_nepotismo_concurso",
    # Vivências — ALL 18
    "q_vi_abuso_sexual_infancia", "q_vi_passou_fome",
    "q_vi_trabalho_infantil", "q_vi_ja_foi_assaltado",
    "q_vi_perdeu_familiar_violencia", "q_vi_desempregado_1ano",
    "q_vi_pai_ausente", "q_vi_sofreu_racismo",
    "q_vi_sofreu_assedio_sexual", "q_vi_depressao_ansiedade",
    "q_vi_pensou_suicidio", "q_vi_preso_ou_familiar_preso",
    "q_vi_sofreu_violencia_domestica", "q_vi_ja_dormiu_na_rua",
    "q_vi_violencia_policial", "q_vi_nao_completou_estudo",
    "q_vi_enchente_desastre", "q_vi_dependencia",
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

    # Note: we no longer highlight "relevant fields" — the classifier
    # analyzes the COMPLETE persona profile (all columns equally)

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

{prompt_header}{disambiguation}Abaixo estao {count} personas sinteticas com seus perfis COMPLETOS — demografia, ideologia, questionario, vieses ocultos e vivencias.

Para CADA persona, analise TODAS as colunas do perfil com IGUAL importancia e determine se ela provavelmente CONCORDA (positive), DISCORDA (negative) ou e NEUTRA (neutral) com a POSICAO EXPRESSA no texto acima.

COMO ANALISAR O PERFIL COMPLETO:
- TODAS as colunas importam igualmente — nao priorize nenhuma sobre outra
- Demografia (idade, regiao, classe, escolaridade, religiao) = contexto de vida
- Scores ideologicos (score_economico, score_costumes) = posicionamento no espectro
- Respostas do questionario (q_*) = posicoes declaradas sobre temas especificos
- Vieses ocultos (ti_*) = tendencias implicitas que afetam reacao a temas sensiveis
- Vivencias (vi_*) = experiencias de vida que moldam perspectiva e empatia
- Dados eleitorais (voto_2022, voto_2026, aprovacao_lula) = lealdade politica
- Considere correlacoes reais da sociedade brasileira entre TODOS esses dados

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
