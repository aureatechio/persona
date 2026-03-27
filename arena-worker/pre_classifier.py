"""
⚠️  CÓDIGO LEGADO — NÃO É O BACKEND DE PRODUÇÃO DA ARENA ⚠️
O backend real está em: scripts/arena_analysis/pre_classifier.py

---

AI Pre-Classifier (versão antiga).
"""

import json
import openai
from config import OPENAI_API_KEY

_client = openai.OpenAI(api_key=OPENAI_API_KEY)


SYSTEM_PROMPT = """Voce e um ANALISTA SEMANTICO para um sistema de pesquisa de opiniao publica brasileira.

Sua tarefa: analisar a pergunta/afirmacao que sera enviada a 20.000 personas sinteticas e produzir uma FICHA DE CLASSIFICACAO estruturada que elimina qualquer ambiguidade sobre o que "concordar" e "discordar" significa neste contexto.

O PROBLEMA QUE VOCE RESOLVE: quando a pergunta menciona figuras politicas com framing complexo (negacoes, ironia, frases compostas), o classificador de personas pode INVERTER o sentimento. Sua analise garante que isso nao aconteca.

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

IRONIA E SARCASMO:
- "Claro que X e honesto, ne?" = provavelmente ATAQUE (sarcasmo)
- "Parabens X por destruir o pais" = ATAQUE (sarcasmo)
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


def pre_classify(question: str, context_text: str | None = None) -> dict:
    """
    Semantically analyze the question/content ONCE before persona batches.
    Returns a structured classification guide that the batch classifier uses.
    """
    user_content = f'Pergunta/Afirmacao: "{question}"'
    if context_text:
        # Truncate context to avoid excessive tokens (this is a pre-flight check, not the full analysis)
        user_content += f'\n\nContexto adicional:\n{context_text[:2000]}'

    try:
        response = _client.chat.completions.create(
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

        # Validate minimum structure — fill in defaults if missing
        if "classification_guide" not in result:
            result["classification_guide"] = {
                "positive_means": "Concorda com a posicao expressa no texto",
                "negative_means": "Discorda da posicao expressa no texto",
                "neutral_means": "Neutro ou sem opiniao formada",
            }
        if "core_position" not in result:
            result["core_position"] = question
        if "type" not in result:
            result["type"] = "other"
        if "figures" not in result:
            result["figures"] = []

        # Log for debugging
        print(f"[PreClassify] type={result['type']} | core: {result['core_position'][:100]}")
        for fig in result.get("figures", []):
            print(f"  figure: {fig.get('name', '?')} → {fig.get('stance', '?')} (conf={fig.get('confidence', '?')})")

        return result

    except Exception as e:
        print(f"[PreClassify] Error: {e} — falling back to passthrough")
        # Safe fallback: returns a neutral guide that doesn't harm classification
        return {
            "type": "other",
            "figures": [],
            "core_position": question,
            "classification_guide": {
                "positive_means": "Concorda com a posicao expressa no texto",
                "negative_means": "Discorda da posicao expressa no texto",
                "neutral_means": "Neutro ou sem opiniao formada",
            },
            "relevant_fields": [],
        }
