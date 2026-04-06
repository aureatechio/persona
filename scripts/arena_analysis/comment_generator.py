"""
Comment Generator — gera 9 comentarios coerentes com os resultados do Persona Scorer.

Recebe os scores reais por segmento e pede ao GPT para gerar comentarios
que reflitam a polarizacao detectada (nao genericos).
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import openai

from arena_analysis.config import settings


SYSTEM_PROMPT = """Voce gera comentarios CURTOS de redes sociais brasileiras.
Recebe o conteudo analisado + resultados reais de como 20.000 personas reagiram.
Seus comentarios devem ser COERENTES com os dados — se eleitores de Lula rejeitaram, os comentarios negativos devem vir de perfis petistas. Se evangelicos aprovaram, os positivos devem vir de perfis evangelicos.

REGRAS:
1. Comentarios de 5-15 palavras (estilo rede social real)
2. Use girias regionais (Nordeste: "oxe", "vixe"; Sul: "bah", "tri"; SP: "mano")
3. Erros de portugues PROPORCIONAIS a escolaridade (Fundamental: muitos erros; Superior: nenhum)
4. Score COERENTE: positive >= 7.0, negative <= 3.0, neutral 4.0-6.0
5. O perfil (nome, cidade, politica, religiao) deve ser COERENTE com o sentimento
   Ex: eleitor de Bolsonaro NAO faz comentario positivo sobre conteudo pro-Lula

Responda APENAS JSON valido, sem markdown."""


def _build_user_prompt(
    question: str,
    core_position: str,
    result: dict[str, Any],
) -> str:
    """Build the prompt with real scoring data for context."""
    segments = result.get("segments", {})

    # Summarize key segment results
    def _top_segments(seg_key: str, n: int = 3) -> str:
        items = segments.get(seg_key, [])
        if not items:
            return "sem dados"
        return ", ".join(
            f"{it.get('label', '?')}: avg={it.get('avgScore', 0):.1f} (pos={it.get('positive', 0)} neg={it.get('negative', 0)})"
            for it in sorted(items, key=lambda x: abs(x.get("avgScore", 5) - 5), reverse=True)[:n]
        )

    return f"""CONTEUDO: "{core_position or question}"

RESULTADOS REAIS DA ANALISE (use para gerar comentarios coerentes):
- Global: {result.get('positive', 0)} aprovaram, {result.get('negative', 0)} rejeitaram, {result.get('neutral', 0)} neutros (avg={result.get('avgScore', 5.0):.1f})
- Voto 2022: {_top_segments('voto2022')}
- Posicao Politica: {_top_segments('politicalLeaning')}
- Religiao: {_top_segments('religion')}
- Regiao: {_top_segments('region')}
- Geracao: {_top_segments('generation')}

Gere EXATAMENTE 9 comentarios no JSON abaixo (3 positivos, 3 negativos, 3 neutros).
Cada comentario deve vir de um PERFIL COERENTE com o sentimento baseado nos dados acima.

[
  {{"sentiment": "positive", "comment": "texto", "personaName": "Nome Sobrenome", "age": 35, "city": "Cidade", "state": "UF", "region": "Regiao", "generation": "Gen X", "gender": "Masculino", "politicalLeaning": "Direita", "score": 8.5}},
  ... (9 total)
]"""


async def generate_comments(
    question: str,
    core_position: str,
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    """Generate 9 comments coherent with Persona Scorer results."""
    keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
    if not keys:
        print("[CommentGen] No OpenAI keys — skipping comments")
        return []

    user_prompt = _build_user_prompt(question, core_position, result)

    try:
        client = openai.AsyncOpenAI(api_key=keys[0])
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=2000,
                temperature=0.8,
                response_format={"type": "json_object"},
            ),
            timeout=15,
        )

        raw = response.choices[0].message.content or ""
        # Parse — response may be {"comments": [...]} or just [...]
        parsed = json.loads(raw.strip())
        comments = parsed if isinstance(parsed, list) else parsed.get("comments", [])

        # Validate and clean
        valid = []
        for c in comments:
            if not isinstance(c, dict) or not c.get("comment"):
                continue
            # Ensure required fields
            c.setdefault("sentiment", "neutral")
            c.setdefault("personaName", "Persona")
            c.setdefault("age", 30)
            c.setdefault("city", "")
            c.setdefault("state", "")
            c.setdefault("region", "")
            c.setdefault("generation", "")
            c.setdefault("gender", "")
            c.setdefault("politicalLeaning", "")
            c.setdefault("score", 5.0)
            c.setdefault("archetype", "")
            c.setdefault("location", f"{c.get('city', '')}, {c.get('state', '')}")
            valid.append(c)

        print(f"[CommentGen] Generated {len(valid)} comments (pos={sum(1 for c in valid if c['sentiment']=='positive')}, neg={sum(1 for c in valid if c['sentiment']=='negative')}, neu={sum(1 for c in valid if c['sentiment']=='neutral')})")
        return valid

    except Exception as e:
        print(f"[CommentGen] Error: {e} — returning empty comments")
        return []
