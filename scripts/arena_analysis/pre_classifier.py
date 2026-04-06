"""
✅ BACKEND DE PRODUÇÃO — Pre-Classifier da Arena.

Roda 1x por análise. GPT-4o-mini analisa a pergunta e produz guia de
classificação (o que significa concordar/discordar). O resultado é
injetado no contexto de cada persona via build_disambiguation_block().

O classificador analisa TODAS as colunas da persona com igual peso —
não prioriza campos específicos.
"""
from __future__ import annotations

import json
from openai import AsyncOpenAI
from arena_analysis.config import settings


SYSTEM_PROMPT = """Voce e um ANALISTA SEMANTICO para um sistema de pesquisa de opiniao publica brasileira.

Sua tarefa: analisar a pergunta/afirmacao que sera enviada a 20.000 personas sinteticas e produzir uma FICHA DE CLASSIFICACAO estruturada que elimina qualquer ambiguidade sobre o que "concordar" e "discordar" significa neste contexto.

O PROBLEMA QUE VOCE RESOLVE: quando a pergunta menciona figuras politicas com framing complexo (negacoes, ironia, frases compostas), o classificador de personas pode INVERTER o sentimento. Sua analise garante que isso nao aconteca.

CONTEXTO POLITICO BRASILEIRO ATUAL:
- GOVERNO/ESQUERDA: Presidente Lula (PT). Aliados: Haddad, Gleisi, Janones, Dino, Boulos.
- OPOSICAO/DIREITA: Jair Bolsonaro (PL), filhos Flavio/Eduardo/Carlos Bolsonaro. Aliados: Tarcisio, Zema, Nikolas Ferreira, Pablo Marcal.
- "governo", "governo federal" = governo LULA. Critica ao governo = critica a LULA.
- REGRA CRITICA PARA FIGURES:
  1. Use SEMPRE nome completo: "Flavio Bolsonaro" (nunca so "Flavio"), "Lula" ou "Luiz Inacio Lula da Silva"
  2. Inclua SEMPRE pelo menos 2 figuras quando o conteudo e politico: quem o autor DEFENDE e quem ATACA
  3. Conteudo pro-Bolsonaro → inclua Bolsonaro (defense) + Lula (attack)
  4. Conteudo pro-Lula → inclua Lula (defense) + Bolsonaro (attack)
  5. NUNCA use termos genericos como "Governo Federal" — use o nome da pessoa

INSTRUCOES:

1. IDENTIFIQUE o TIPO do conteudo:
   - "political_figure" — menciona pessoa publica/politica com posicao clara
   - "policy_topic" — debate sobre politica publica/tema social (aborto, armas, etc.)
   - "moral_extreme" — proposicao extrema/violenta que a maioria rejeita
   - "factual" — pergunta factual sem posicao ideologica
   - "mixed" — combina figura politica com tema de politica publica
   - "other" — nao se encaixa nas categorias acima

2. IDENTIFIQUE FIGURAS POLITICAS/PUBLICAS mencionadas (se houver):
   - Nome da figura
   - Stance: "attack" (o texto CRITICA/ATACA a figura), "defense" (o texto DEFENDE a figura), "neutral_mention" (mencao sem posicao)
   - Confianca (0.0 a 1.0)

3. ESCREVA A POSICAO EXPRESSA em linguagem clara e sem ambiguidade.
   Esta e a frase mais importante — ela deve capturar exatamente o que o autor esta dizendo.

4. GERE O GUIA DE CLASSIFICACAO:
   - positive_means: o que significa quando uma persona CONCORDA (em relacao a posicao expressa)
   - negative_means: o que significa quando uma persona DISCORDA
   - neutral_means: o que significa quando uma persona e neutra

5. NOTA: O classificador analisa TODAS as colunas da persona com igual importancia (demografia, questionario, vieses ocultos, vivencias). Voce NAO precisa listar campos relevantes — todos sao analisados.

REGRAS CRITICAS PARA NEGACOES:
- "X e corrupto" = ATAQUE a X (stance: attack)
- "X NAO e corrupto" = DEFESA de X (stance: defense) — o "nao" inverte o significado
- "X e corrupto e NAO deveria ser presidente" = ATAQUE a X — a frase toda e uma critica, o "nao deveria" reforça o ataque
- "X nao deveria ser preso, e inocente" = DEFESA de X
- "X roubou mas fez" = MISTO, mas predomina visao ambivalente-positiva

IRONIA E SARCASMO BRASILEIRO — ATENCAO REDOBRADA:
Brasileiros usam sarcasmo PESADO. Detecte estes padroes:
- "Claro que X e honesto, ne?" = ATAQUE (sarcasmo)
- "Parabens X por destruir o pais" = ATAQUE (sarcasmo)
- "X e tao honesto quanto o Fernandinho Beira-Mar" = ATAQUE (comparacao com criminoso = sarcasmo)
- "Nosso grande democrata" / "genio incompreendido" = ATAQUE (elogio desproporcional = sarcasmo)
- "Claro, porque funcionou tao bem da ultima vez" = ATAQUE (referencia a fracasso)
- "Parabens, destruiu o pais em tempo recorde" = ATAQUE (elogio + acao negativa)
REGRA: Se o elogio e DESPROPORCIONAL, COMPARATIVO com algo negativo, ou seguido de resultado ruim → e SARCASMO → classifique como ATAQUE.
- Quando ambiguo, classifique como o significado mais provavel

AFIRMACOES COMPOSTAS:
- Trate a frase INTEIRA como uma unica posicao. NAO separe em partes independentes.
- "X e corrupto e nao deveria ser presidente" = UMA posicao (contra X)
- "X fez coisas boas mas destruiu a economia" = UMA posicao (predominantemente contra X)

FORMATO DE RESPOSTA (use EXATAMENTE estes nomes de campo em ingles):
{
  "type": "political_figure | policy_topic | moral_extreme | factual | mixed | other",
  "figures": [{"name": "Nome", "stance": "attack | defense | neutral_mention", "confidence": 0.95}],
  "core_position": "Frase clara descrevendo a posicao expressa pelo autor",
  "classification_guide": {
    "positive_means": "O que significa concordar com o texto",
    "negative_means": "O que significa discordar do texto",
    "neutral_means": "O que significa ser neutro"
  },
}

Responda APENAS com JSON valido usando os nomes de campo EXATOS acima (type, figures, core_position, classification_guide). NAO inclua "relevant_fields" — o classificador analisa TODAS as colunas."""


_FALLBACK = {
    "type": "other",
    "figures": [],
    "core_position": "",
    "classification_guide": {
        "positive_means": "Concorda com a posicao expressa no texto",
        "negative_means": "Discorda da posicao expressa no texto",
        "neutral_means": "Neutro ou sem opiniao formada",
    },
    "relevant_fields": [],
}


async def pre_classify(question: str, context_text: str | None = None) -> dict:
    """
    Semantically analyze the question/content ONCE before persona batches.
    Returns a structured classification guide.

    Uses the first available OpenAI key (GPT-4o-mini is fast and cheap for this).
    """
    keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
    if not keys:
        print("[PreClassify] No OpenAI keys available — skipping")
        return {**_FALLBACK, "core_position": question}

    user_content = f'Pergunta/Afirmacao: "{question}"'
    if context_text:
        user_content += f'\n\nContexto adicional:\n{context_text[:2000]}'

    client = AsyncOpenAI(api_key=keys[0])

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)

        # Validate minimum structure
        if "classification_guide" not in result:
            result["classification_guide"] = _FALLBACK["classification_guide"]
        if "core_position" not in result:
            result["core_position"] = question
        if "type" not in result:
            result["type"] = "other"
        if "figures" not in result:
            result["figures"] = []

        print(f"[PreClassify] type={result['type']} | core: {result['core_position'][:100]}", flush=True)
        for fig in result.get("figures", []):
            print(f"  figure: {fig.get('name', '?')} -> {fig.get('stance', '?')} (conf={fig.get('confidence', '?')})", flush=True)

        return result

    except Exception as e:
        print(f"[PreClassify] Error: {type(e).__name__}: {e} -- falling back to passthrough", flush=True)
        return {**_FALLBACK, "core_position": question}


def build_disambiguation_block(pre_class: dict | None) -> str:
    """
    Build the semantic disambiguation block from the pre-classifier output.
    This is injected into the batch prompt BEFORE persona profiles.
    Replaces ALL hardcoded political framing rules, word lists, and regex patterns.
    """
    if not pre_class or not pre_class.get("classification_guide"):
        return ""

    guide = pre_class["classification_guide"]
    core = pre_class.get("core_position", "")

    lines = [
        "",
        "═══ ANALISE SEMANTICA PRE-PROCESSADA (SIGA EXATAMENTE) ═══",
        f"POSICAO EXPRESSA NO TEXTO: {core}",
        "",
        "REGRA DE CLASSIFICACAO:",
        f'→ score 7-10 (positive) = {guide.get("positive_means", "Concorda com a posicao expressa")}',
        f'→ score 0-3 (negative) = {guide.get("negative_means", "Discorda da posicao expressa")}',
        f'→ score 4-6 (neutral) = {guide.get("neutral_means", "Neutro ou sem opiniao formada")}',
    ]

    for fig in pre_class.get("figures", []):
        name = fig.get("name", "")
        stance = fig.get("stance", "")
        if not name or not stance:
            continue

        if stance == "attack":
            lines.extend([
                "",
                f"FIGURA: {name} — O texto ATACA/CRITICA {name}.",
                f"→ Quem APOIA {name} (aprova, votou nele) → score BAIXO (0-3)",
                f"→ Quem se OPOE a {name} (desaprova, votou contra) → score ALTO (7-10)",
            ])
        elif stance == "defense":
            lines.extend([
                "",
                f"FIGURA: {name} — O texto DEFENDE {name}.",
                f"→ Quem APOIA {name} → score ALTO (7-10)",
                f"→ Quem se OPOE a {name} → score BAIXO (0-3)",
            ])

    # Note: we no longer highlight "relevant fields" — the classifier
    # analyzes the COMPLETE persona profile (all columns equally)

    lines.append("═══ FIM DA ANALISE SEMANTICA ═══")
    lines.append("")

    return "\n".join(lines)
