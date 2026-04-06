"""
Visual Analyzer — abordagem híbrida:
  - analyze_image(): GPT-4o Vision (melhor reconhecimento facial e de detalhes)
  - analyze_video(): Gemini 2.5 Pro nativo (áudio + visual + temporal em 1 chamada)
"""
from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

import httpx
import openai
from google import genai
from google.genai import types

from arena_analysis.config import settings

# ── OpenAI Client (image analysis — key rotation) ───────────────────────────
_oai_key_idx = 0


def _get_openai_client() -> openai.AsyncOpenAI:
    global _oai_key_idx
    keys = settings.openai_api_keys or [settings.openai_api_key]
    key = keys[_oai_key_idx % len(keys)]
    _oai_key_idx += 1
    return openai.AsyncOpenAI(api_key=key)


# ── Gemini Client (video analysis — singleton) ──────────────────────────────
_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY não configurada")
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


# ── Prompts ──────────────────────────────────────────────────────────────────
VISUAL_SYSTEM_PROMPT = """Voce e um diretor criativo e analista de comunicacao politica brasileira com 20 anos de experiencia.
Analise a imagem fornecida com atencao MAXIMA a cada detalhe visual e textual.

INSTRUCAO CRITICA: Leia e transcreva TODOS os textos visiveis na imagem — titulos, subtitulos, numeros, legendas, logos, marcas d'agua, creditos, hashtags. NUNCA diga que nao ha texto se houver qualquer caractere visivel.

Analise em DUAS partes:

PARTE A — CONTEUDO E INTENCAO:
1. Mensagem central: o que a imagem comunica (tese, posicionamento politico)
2. Quem produziu: identifique fonte, branding, gabinete, partido (ex: "gabinete do senador Flavio Bolsonaro")
3. Dados/numeros: como sao enfatizados visualmente (tamanho, cor, posicao)
4. Tecnicas de persuasao: manipulacao emocional, enquadramento tendencioso, contraste, urgencia
5. Publico-alvo: quem essa imagem quer atingir e por que
6. Transcricao COMPLETA: TODO texto visivel na imagem (incluindo logos, marcas d'agua, creditos, numeros pequenos)
7. Figuras politicas: mencionadas, mostradas OU ALVOS IMPLICITOS, com alinhamento e posicao do autor.
   REGRA CRITICA: Identifique TANTO o autor/fonte QUANTO o alvo do conteudo.
   - Se o conteudo e do gabinete Bolsonaro criticando politicas do governo → inclua TANTO Bolsonaro (a favor) QUANTO Lula/PT (contra)
   - Se o conteudo e de militante petista atacando Bolsonaro → inclua TANTO Lula/PT (a favor) QUANTO Bolsonaro (contra)
   - O ALVO pode nao estar explicitamente nomeado — deduza pelo contexto politico brasileiro
   - Exemplo: imagem do gabinete Bolsonaro sobre crime = autor pro-Bolsonaro, alvo = governo Lula (contra)

PARTE B — PRODUCAO TECNICA (critica de diretor criativo):
1. HIERARQUIA DE LAYOUT: elemento dominante vs secundario vs terciario. Se algo compete por atencao, diga
2. TIPOGRAFIA: fontes, tamanhos relativos, cores, enfases. Texto pequeno demais para celular? Grande demais?
3. PALETA DE CORES: cores dominantes, clima visual, se fortalecem ou enfraquecem a mensagem
4. FOTO/IMAGEM: expressao facial (se houver), angulo, iluminacao, recorte. Reforça ou enfraquece a mensagem?
5. ELEMENTOS GRAFICOS: setas, badges, logos, molduras, gradientes. O que funciona e o que polui
6. LEGIBILIDADE EM CELULAR: a imagem funciona em tela pequena? Textos legiveis? Elementos muito pequenos?
7. O QUE FUNCIONA BEM: 3-5 acertos especificos com detalhe (ex: "o numero em destaque gruda na memoria", "a cor vermelha no 'nao' reforça a negatividade")
8. O QUE MELHORAR: 3-5 sugestoes CONCRETAS e ACIONAVEIS (ex: "diminuir o 53% — ta competindo com a foto", "colocar o nome do instituto embaixo como fonte credivel")
9. POTENCIAL DE ENGAJAMENTO: nota 0-10 da qualidade do material + veredicto em 1-2 frases (se esta bom, parabenize. Se esta ruim, diga o que mudar)

FORMATO DE RESPOSTA (JSON):
{
  "content_analysis": "Texto completo da Parte A (detalhado, 200-500 palavras)",
  "visual_structure": "Texto completo da Parte B (detalhado, 300-700 palavras)",
  "core_point": "Frase curta com FRAMING: quem publicou + posicao + tese (max 120 chars). Ex: 'Gabinete Bolsonaro ataca Lula usando pesquisa de rejeicao' ou 'Post pro-Lula celebra queda da inflacao'. NUNCA seja factual neutro — capture a INTENCAO do autor.",
  "political_figures": [{"nome": "Nome Completo", "alinhamento": "direita|centro-direita|centro|centro-esquerda|esquerda", "posicao_autor": "a favor|contra|neutro"}]
}

REGRA PARA political_figures:
- Inclua SEMPRE pelo menos 2 figuras quando o conteudo e politico: o AUTOR/FONTE e o ALVO
- posicao_autor="a favor" = o conteudo DEFENDE/APOIA esta figura
- posicao_autor="contra" = o conteudo ATACA/CRITICA esta figura ou seu governo/partido
- Se a imagem e do gabinete Bolsonaro criticando o governo, INCLUA: Bolsonaro (a favor) + Lula (contra)
- Se a imagem e de petista elogiando Lula, INCLUA: Lula (a favor) + possivelmente Bolsonaro (contra)
Se nao houver figuras politicas, use "political_figures": [].
Responda APENAS o JSON, sem markdown, sem code blocks."""

VIDEO_SYSTEM_PROMPT = """Voce e um diretor criativo e analista de comunicacao politica brasileira com 20 anos de experiencia.
Voce recebera um VIDEO politico completo. Assista o video INTEIRO com atencao maxima a TODOS os detalhes: imagem, audio, textos na tela, legendas, trilha sonora.

INSTRUCAO CRITICA: Preste atencao especial a:
- LEGENDAS e TEXTOS SOBREPOSTOS: se houver QUALQUER texto na tela em QUALQUER momento (legendas, lower thirds, titulos, numeros, hashtags, watermarks), voce DEVE transcrever e mencionar. NUNCA diga que nao ha legendas se houver texto na tela.
- AUDIO: ouca atentamente a narracao, musica de fundo, efeitos sonoros, tom de voz.

Analise o video completo em TRES partes:

PARTE A — CONTEUDO E INTENCAO:
1. Mensagem central: o que o video defende, ataca ou comunica (seja especifico)
2. Quem produziu: identifique fonte, canal, partido, gabinete, influenciador
3. Narracao e fala: QUEM fala, O QUE diz (resuma os pontos principais da fala), TOM DE VOZ (agressivo, calmo, didatico, emocional, ironico)
4. Dados/numeros: qualquer estatistica ou numero mostrado (na tela OU falado)
5. Textos na tela: transcricao COMPLETA de TODOS os textos que aparecem (legendas, titulos, lower thirds, hashtags, creditos, marcas d'agua). Se nenhum texto aparece, diga explicitamente "Nenhum texto sobreposto identificado"
6. Tecnicas de persuasao: cortes emocionais, musica manipulativa, enquadramento tendencioso, repeticao, contraste antes/depois
7. Publico-alvo: quem esse video quer atingir e por que
8. Figuras politicas: quem aparece, e mencionado OU E ALVO IMPLICITO, com alinhamento e posicao do autor.
   REGRA CRITICA: Identifique TANTO o autor/fonte QUANTO o alvo do conteudo.
   - Se o video e do campo Bolsonaro criticando o governo → inclua TANTO Bolsonaro (a favor) QUANTO Lula/PT (contra)
   - Se o video e de petista atacando Bolsonaro → inclua TANTO Lula/PT (a favor) QUANTO Bolsonaro (contra)
   - O ALVO pode nao estar explicitamente nomeado — deduza pelo contexto politico brasileiro

PARTE B — PRODUCAO TECNICA (critica de diretor criativo):
1. IDENTIDADE VISUAL: paleta de cores, estilo grafico, consistencia entre cenas
2. LEGENDAS E TEXTOS: fontes, tamanhos, cores, posicionamento, legibilidade em tela de CELULAR (critico — maioria assiste no celular). Texto pequeno demais? Tempo de exibicao curto demais?
3. COMPOSICAO E ENQUADRAMENTO: uso de espaco, hierarquia visual, angulos de camera
4. TRILHA SONORA E AUDIO: musica de fundo (genero, energia, emocao que transmite), mixagem (voz clara sobre a musica ou abafada?), efeitos sonoros, silencio estrategico
5. RITMO E EDICAO: velocidade dos cortes, transicoes, ritmo geral (dinamico ou arrastado?), hook nos primeiros 3 segundos
6. GRAFICOS E DADOS: se usa graficos/numeros, sao claros ou confusos? Entram e saem rapido demais?
7. O QUE FUNCIONA BEM: 3-5 acertos especificos (elogie com detalhe — ex: "o corte para a foto do idoso no segundo 15 gera empatia imediata", "a trilha tensa no momento certo amplifica a indignacao")
8. O QUE MELHORAR: 3-5 sugestoes CONCRETAS e ACIONAVEIS (ex: "a legenda some em 1.5s — precisa de pelo menos 3s para leitura no celular", "a musica ta alta demais, abafa a voz no segundo 20-30", "falta hook nos primeiros 3s — comecar com o dado mais chocante")

PARTE C — POTENCIAL DE ENGAJAMENTO:
1. Nota geral de producao (0-10): avalie a qualidade tecnica do material como um todo
2. Veredicto: em 2-3 frases, diga se esse material tem potencial de VIRALIZAR, ENGAJAR, ou se vai PASSAR DESPERCEBIDO. Seja direto e honesto — se o trabalho esta bom, parabenize. Se esta ruim, diga o que precisa mudar com urgencia.

FORMATO DE RESPOSTA (JSON):
{
  "content_analysis": "Texto completo da Parte A (detalhado, 300-800 palavras)",
  "visual_structure": "Texto completo da Parte B + Parte C (detalhado, 400-1000 palavras)",
  "core_point": "Frase curta com FRAMING: quem publicou + posicao + tese (max 120 chars). Ex: 'Video pro-Bolsonaro ataca governo Lula com dados de desemprego' ou 'Militante de esquerda defende programa social'. NUNCA seja factual neutro — capture a INTENCAO do autor.",
  "political_figures": [{"nome": "Nome Completo", "alinhamento": "direita|centro-direita|centro|centro-esquerda|esquerda", "posicao_autor": "a favor|contra|neutro"}]
}

REGRA PARA political_figures:
- Inclua SEMPRE pelo menos 2 figuras quando o conteudo e politico: o AUTOR/FONTE e o ALVO
- posicao_autor="a favor" = o conteudo DEFENDE/APOIA esta figura
- posicao_autor="contra" = o conteudo ATACA/CRITICA esta figura ou seu governo/partido
- Se o video e do campo Bolsonaro criticando o governo, INCLUA: Bolsonaro (a favor) + Lula (contra)
- Se o video e de petista elogiando Lula, INCLUA: Lula (a favor) + possivelmente Bolsonaro (contra)
Se nao houver figuras politicas, use "political_figures": [].
Responda APENAS o JSON, sem markdown, sem code blocks."""


# ── Helpers ─────────────────────────────────────────────────────────────────
def _empty_result() -> dict[str, Any]:
    return {
        "content_analysis": "",
        "visual_structure": "",
        "core_point": "",
        "political_figures": [],
    }


def _parse_response(raw: str) -> dict[str, Any]:
    """Parse JSON from Gemini response, stripping code fences if present."""
    import re
    clean = raw.strip()
    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    clean = re.sub(r'^```(?:json)?\s*', '', clean)
    clean = re.sub(r'\s*```\s*$', '', clean)
    clean = clean.strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end <= start:
        return _empty_result()
    try:
        return json.loads(clean[start:end + 1])
    except json.JSONDecodeError:
        return _empty_result()


# ── Image Analysis (GPT-4o Vision) ──────────────────────────────────────────
async def analyze_image(
    image_data: str,
    image_type: str = "base64",
    mime_type: str = "image/jpeg",
    caption: str = "",
) -> dict[str, Any]:
    """
    Analisa uma imagem com GPT-4o Vision.
    GPT-4o tem melhor reconhecimento de figuras públicas e detalhes visuais.

    Args:
        image_data: base64 string (sem prefix data:) OU URL http(s)
        image_type: "base64" ou "url"
        mime_type: MIME type da imagem (ex: "image/jpeg")
        caption: texto/legenda que o usuario digitou junto com a imagem (contexto)
    """
    try:
        # Build image content for GPT-4o
        if image_type == "url":
            image_content = {
                "type": "image_url",
                "image_url": {"url": image_data, "detail": "high"},
            }
        else:
            data_url = f"data:{mime_type};base64,{image_data}"
            image_content = {
                "type": "image_url",
                "image_url": {"url": data_url, "detail": "high"},
            }

        # Build user prompt with caption context
        if caption:
            user_text = (
                f"Analise esta imagem em detalhes.\n\n"
                f"CONTEXTO/LEGENDA DO AUTOR: \"{caption}\"\n\n"
                f"Use esse contexto como REFERENCIA, mas identifique as pessoas pela APARENCIA VISUAL, "
                f"nao apenas pelo que a legenda diz. Se a legenda menciona alguem que NAO aparece na imagem, "
                f"diga explicitamente. Se voce reconhece alguem que NAO esta na legenda, mencione tambem. "
                f"NAO invente datas, nomes ou eventos que nao estejam na legenda ou na imagem."
            )
        else:
            user_text = "Analise esta imagem em detalhes:"

        messages = [
            {"role": "system", "content": VISUAL_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    image_content,
                ],
            },
        ]

        # Try all available OpenAI keys
        keys = settings.openai_api_keys or [settings.openai_api_key]
        last_error = None
        for key_idx, api_key in enumerate(keys):
            try:
                client = openai.AsyncOpenAI(api_key=api_key)
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=settings.vision_model,
                        max_tokens=settings.vision_max_tokens,
                        messages=messages,
                    ),
                    timeout=settings.gemini_vision_timeout,
                )

                raw = response.choices[0].message.content or ""
                result = _parse_response(raw)
                tokens_in = response.usage.prompt_tokens if response.usage else 0
                tokens_out = response.usage.completion_tokens if response.usage else 0
                print(f"[Visual] Image analyzed (GPT-4o, key {key_idx + 1}): "
                      f"content={len(result.get('content_analysis', ''))} chars, "
                      f"structure={len(result.get('visual_structure', ''))} chars, "
                      f"tokens={tokens_in}+{tokens_out}")
                return result

            except asyncio.TimeoutError:
                print(f"[Visual] Image analysis timed out on key {key_idx + 1}")
                last_error = "timeout"
                continue
            except Exception as key_err:
                print(f"[Visual] GPT-4o key {key_idx + 1}/{len(keys)} failed: {key_err}")
                last_error = key_err
                continue

        print(f"[Visual] All {len(keys)} OpenAI keys failed. Last error: {last_error}")
        return _empty_result()

    except Exception as e:
        print(f"[Visual] Image analysis error: {e}")
        return _empty_result()


# ── Video Analysis (Gemini native) ──────────────────────────────────────────
async def analyze_video(video_path: str) -> dict[str, Any]:
    """
    Analisa um vídeo completo com Gemini 2.5 Pro via File API.
    Gemini processa vídeo nativamente: áudio + visual + temporal em 1 chamada.
    """
    video_file = None
    try:
        client = _get_gemini_client()

        # 1. Upload video to Gemini File API
        print(f"[Visual] Uploading video to Gemini File API: {video_path}")
        video_file = await asyncio.wait_for(
            client.aio.files.upload(file=video_path),
            timeout=60,
        )
        print(f"[Visual] Video uploaded: {video_file.name} (state={video_file.state})")

        # 2. Wait for processing if needed
        poll_count = 0
        while video_file.state and "ACTIVE" not in str(video_file.state).upper():
            state_str = str(video_file.state).upper()
            if "FAILED" in state_str:
                print(f"[Visual] Gemini video processing FAILED (state={video_file.state})")
                return _empty_result()
            if poll_count == 0:
                print(f"[Visual] Waiting for Gemini to process video (state={video_file.state})...")
            poll_count += 1
            if poll_count > 60:  # 120s max wait
                print("[Visual] Video processing timed out waiting for ACTIVE state")
                return _empty_result()
            await asyncio.sleep(2)
            video_file = await client.aio.files.get(name=video_file.name)

        if poll_count > 0:
            print(f"[Visual] Video processing complete after {poll_count * 2}s (state={video_file.state})")

        # 3. Analyze with Gemini 2.5 Pro
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.gemini_vision_model,
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                            types.Part.from_text(text="Assista o video INTEIRO com atencao maxima. Analise TODOS os detalhes: imagem, audio, textos na tela, legendas, trilha sonora, tom de voz."),
                        ]
                    ),
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=12000,
                    temperature=0.2,
                    system_instruction=VIDEO_SYSTEM_PROMPT,
                ),
            ),
            timeout=settings.gemini_video_timeout,
        )

        # Extract text from all parts (Gemini 2.5 Pro thinking mode puts
        # the thinking in parts[0] and the actual response in parts[1])
        raw = response.text or ""
        if not raw and response.candidates:
            parts_text = []
            for part in response.candidates[0].content.parts:
                txt = getattr(part, "text", None)
                thought = getattr(part, "thought", None)
                if txt and not thought:  # skip thinking parts
                    parts_text.append(txt)
            if parts_text:
                raw = "\n".join(parts_text)
                print(f"[Visual] Extracted {len(raw)} chars from {len(parts_text)} non-thinking parts")
        result = _parse_response(raw)
        usage = response.usage_metadata
        tokens_in = usage.prompt_token_count if usage else 0
        tokens_out = usage.candidates_token_count if usage else 0
        print(f"[Visual] Video analyzed (Gemini native): "
              f"content={len(result.get('content_analysis', ''))} chars, "
              f"structure={len(result.get('visual_structure', ''))} chars, "
              f"tokens={tokens_in}+{tokens_out}")
        return result

    except asyncio.TimeoutError:
        print(f"[Visual] Video analysis timed out ({settings.gemini_video_timeout}s)")
        return _empty_result()
    except Exception as e:
        print(f"[Visual] Video analysis error: {e}")
        import traceback
        traceback.print_exc()
        return _empty_result()
    finally:
        # Cleanup: delete uploaded file from Gemini (fire-and-forget)
        if video_file and hasattr(video_file, 'name') and video_file.name:
            try:
                client = _get_gemini_client()
                await client.aio.files.delete(name=video_file.name)
                print(f"[Visual] Cleaned up Gemini file: {video_file.name}")
            except Exception:
                pass  # Non-critical; Gemini auto-deletes after 48h


# ── Backward-compatible alias (used by main.py) ────────────────────────────
async def extract_and_analyze_frames(
    video_path: str,
    num_frames: int = 10,
) -> dict[str, Any]:
    """Backward-compatible wrapper. Now uses native Gemini video analysis."""
    return await analyze_video(video_path)
