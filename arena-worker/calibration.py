"""
⚠️  CÓDIGO LEGADO — NÃO É O BACKEND DE PRODUÇÃO DA ARENA ⚠️
O backend real está em: scripts/arena_analysis/calibration_endpoint.py

---

Verbose wrappers for calibration mode (versão antiga).
"""

import json
import time
import openai
from config import OPENAI_API_KEY
from classifier import _build_persona_summary, _build_disambiguation, PROFILE_FIELDS
from pre_classifier import SYSTEM_PROMPT as PRE_CLASSIFY_SYSTEM_PROMPT

_client = openai.OpenAI(api_key=OPENAI_API_KEY)


def pre_classify_verbose(question: str, context_text: str | None = None) -> dict:
    """
    Same as pre_classify() but returns the full prompts and raw response
    for calibration inspection.
    """
    user_content = f'Pergunta/Afirmacao: "{question}"'
    if context_text:
        user_content += f'\n\nContexto adicional:\n{context_text[:2000]}'

    start = time.time()
    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PRE_CLASSIFY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        latency_ms = round((time.time() - start) * 1000)
        tokens = response.usage.total_tokens if response.usage else 0
        result = json.loads(raw)

        # Fill defaults
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

        return {
            "result": result,
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": user_content,
            "raw_response": raw,
            "latency_ms": latency_ms,
            "tokens": tokens,
        }

    except Exception as e:
        latency_ms = round((time.time() - start) * 1000)
        fallback = {
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
        return {
            "result": fallback,
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": user_content,
            "raw_response": f"ERROR: {e}",
            "latency_ms": latency_ms,
            "tokens": 0,
        }


def classify_batch_verbose(
    question: str,
    personas: list[dict],
    context_text: str | None = None,
    pre_class: dict | None = None,
) -> dict:
    """
    Same as classify_batch() but returns the full prompt, raw response,
    per-persona summaries, and timing for calibration inspection.
    """
    if not personas:
        return {
            "sentiments": [],
            "prompt": "",
            "raw_response": "",
            "persona_summaries": [],
            "latency_ms": 0,
            "tokens": 0,
        }

    # Build persona summaries (same as classifier.py)
    persona_texts = []
    for i, p in enumerate(personas):
        persona_texts.append(_build_persona_summary(p, i))

    personas_block = "\n".join(persona_texts)
    count = len(personas)

    # Build prompt header (same logic as classifier.py)
    if context_text and len(context_text) > len(question):
        prompt_header = f'Tema em debate:\n"{context_text[:3000]}"\n'
        if question and question != context_text[:500]:
            prompt_header += f'\nPergunta associada: "{question}"\n'
    else:
        prompt_header = f'Pergunta em debate: "{question}"\n'
        if context_text:
            prompt_header += f'\nContexto adicional: {context_text}\n'

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

    start = time.time()
    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=count * 15,
        )

        raw = response.choices[0].message.content.strip()
        latency_ms = round((time.time() - start) * 1000)
        tokens = response.usage.total_tokens if response.usage else 0

        # Parse JSON array
        clean = raw
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        results = json.loads(clean)

        valid = {"positive", "negative", "neutral"}
        sentiments = [r if r in valid else "neutral" for r in results[:count]]

        return {
            "sentiments": sentiments,
            "prompt": prompt,
            "raw_response": raw,
            "persona_summaries": persona_texts,
            "latency_ms": latency_ms,
            "tokens": tokens,
        }

    except Exception as e:
        latency_ms = round((time.time() - start) * 1000)
        print(f"[Calibration Classifier] GPT error: {e}")
        return {
            "sentiments": ["neutral"] * count,
            "prompt": prompt,
            "raw_response": f"ERROR: {e}",
            "persona_summaries": persona_texts,
            "latency_ms": latency_ms,
            "tokens": 0,
        }
