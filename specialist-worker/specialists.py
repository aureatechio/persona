"""
Specialist Worker — Specialist definitions and shared context builder.

Prompts are loaded from Supabase table `arena_prompts` (hot-reloadable).
This file defines the specialist metadata and builds the shared data context.
"""

# Specialist metadata (prompts come from Supabase)
SPECIALISTS = {
    "designer_politico": {
        "id": "designer_politico",
        "name": "Designer Politico",
        "emoji": "palette",
        "prompt_id": "specialist_designer_politico",
    },
    "estrategista_redes": {
        "id": "estrategista_redes",
        "name": "Estrategista de Redes",
        "emoji": "trending-up",
        "prompt_id": "specialist_estrategista_redes",
    },
    "copywriter_politico": {
        "id": "copywriter_politico",
        "name": "Copywriter Politico",
        "emoji": "pencil",
        "prompt_id": "specialist_copywriter_politico",
    },
    "analista_opiniao": {
        "id": "analista_opiniao",
        "name": "Analista de Opiniao Publica",
        "emoji": "bar-chart",
        "prompt_id": "specialist_analista_opiniao",
    },
    "editor_visual": {
        "id": "editor_visual",
        "name": "Editor de Video/Imagem",
        "emoji": "image",
        "prompt_id": "specialist_editor_visual",
    },
}

# JSON output schema appended to every specialist prompt
OUTPUT_SCHEMA = """

FORMATO OBRIGATORIO — responda EXCLUSIVAMENTE com JSON valido, sem markdown:
{
  "verdict": "Sua conclusao direta sobre o conteudo. Max 80 caracteres. Tom incisivo.",
  "riskLevel": "baixo|medio|alto|critico",
  "keyPoints": [
    "Ponto 1: com DADO ESPECIFICO dos segmentos (porcentagem, grupo)",
    "Ponto 2: com DADO ESPECIFICO dos segmentos",
    "Ponto 3: opcional, com dado"
  ],
  "recommendations": [
    {
      "text": "Recomendacao acionavel e especifica",
      "priority": "urgente|importante|oportunidade",
      "segment": "Segmento demografico alvo (opcional, ex: 'Evangelicos', 'Gen Z')"
    }
  ],
  "dataHighlight": "O dado MAIS surpreendente que voce notou na sua area de expertise (1 frase)"
}

REGRAS:
- verdict: MAXIMO 80 caracteres. Seja DIRETO e INCISIVO.
- riskLevel: avalie o RISCO real que este conteudo representa na sua area
- keyPoints: 2-3 pontos. CADA ponto deve citar um DADO NUMERICO dos segmentos fornecidos
- recommendations: 1-2 recomendacoes ACIONAVEIS. Cada uma com priority e segment opcional
- dataHighlight: o dado mais SURPREENDENTE ou CONTRA-INTUITIVO que voce notou. Pode ser null
- RESPONDA APENAS O JSON. Sem explicacoes, sem markdown, sem ```json
- PORTUGUES CORRETO com TODOS os acentos e cedilhas: você, não, opinião, reeleição, análise, composição, atenção, memória, número, é, está, já, só, até.
- Use traço simples (-) para separar ideias, mas NUNCA traço duplo (--) ou travessão (—).
- NUNCA use markdown (**, ##, __). Texto corrido, limpo e fluido."""


def get_all_specialist_ids() -> list[str]:
    return list(SPECIALISTS.keys())


def build_context(payload: dict) -> str:
    """
    Build shared context string from arena payload data.
    All specialists receive the same context — their prompts differ.
    """
    segments = payload.get("segments", {})
    question = payload.get("question", "")
    positive = payload.get("positive", 0)
    negative = payload.get("negative", 0)
    neutral = payload.get("neutral", 0)
    total = positive + negative + neutral
    content_meta = payload.get("contentMeta", {})

    pct_pos = f"{(positive / total * 100):.1f}" if total > 0 else "0"
    pct_neg = f"{(negative / total * 100):.1f}" if total > 0 else "0"
    pct_neu = f"{(neutral / total * 100):.1f}" if total > 0 else "0"

    def format_seg(items: list) -> str:
        if not items:
            return ""
        lines = []
        for s in items[:8]:
            t = s.get("positive", 0) + s.get("negative", 0) + s.get("neutral", 0)
            if t == 0:
                continue
            ppos = f"{(s['positive'] / t * 100):.0f}"
            pneg = f"{(s['negative'] / t * 100):.0f}"
            pneu = f"{(s['neutral'] / t * 100):.0f}"
            lines.append(
                f"  {s['label']}: {ppos}% favor, {pneg}% contra, {pneu}% neutro (n={t})"
            )
        return "\n".join(lines)

    category_labels = {
        "gender": "Genero",
        "religion": "Religiao",
        "race": "Raca/Etnia",
        "region": "Regiao",
        "generation": "Geracao",
        "socialClass": "Classe Social",
        "education": "Escolaridade",
        "politicalLeaning": "Posicao Politica",
        "voto2022": "Voto 2022",
        "voto2026": "Intencao 2026",
        "clusterMacro": "Cluster Macro",
        "archetype": "Arquetipo",
    }

    seg_blocks = []
    for key, label in category_labels.items():
        items = segments.get(key, [])
        if items:
            formatted = format_seg(items)
            if formatted:
                seg_blocks.append(f"{label}:\n{formatted}")

    raw_media = content_meta.get("mediaType", "nao especificado")
    media_types = raw_media if isinstance(raw_media, list) else [s.strip() for s in str(raw_media).split(",")]
    media_label = ", ".join(media_types)
    ideology = content_meta.get("candidateIdeology", "nao especificado")
    region = content_meta.get("region", "Brasil")
    city = content_meta.get("city", "")
    attachment = content_meta.get("attachmentType", "text")

    return f"""MATERIAL ANALISADO: "{question}"

RESULTADO GERAL:
- A Favor: {pct_pos}% ({positive} personas)
- Contra: {pct_neg}% ({negative} personas)
- Neutros: {pct_neu}% ({neutral} personas)
- Total: {total} personas analisadas

CONTEXTO DO CONTEUDO:
- Plataformas: {media_label.upper()}
- Tipo de midia: {attachment.upper()}
- Posicionamento ideologico: {ideology}
- Regiao alvo: {f"{city} - {region}" if city else region}

BREAKDOWN DEMOGRAFICO COMPLETO:
{chr(10).join(seg_blocks) if seg_blocks else "Dados nao disponiveis"}"""
