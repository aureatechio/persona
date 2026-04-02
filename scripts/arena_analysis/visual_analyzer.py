"""
Visual Analyzer — analisa imagens e frames de vídeo com GPT-4o vision.

Duas funções principais:
  - analyze_image(): análise profunda de 1 imagem (conteúdo + estrutura visual)
  - extract_and_analyze_frames(): extrai frames de vídeo com FFmpeg e analisa visualmente
"""
from __future__ import annotations

import asyncio
import base64
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import openai

from arena_analysis.config import settings

# ── Key rotation ────────────────────────────────────────────────────────────
_key_idx = 0


def _get_client() -> openai.AsyncOpenAI:
    global _key_idx
    keys = settings.openai_api_keys or [settings.openai_api_key]
    key = keys[_key_idx % len(keys)]
    _key_idx += 1
    return openai.AsyncOpenAI(api_key=key)


# ── Prompt ──────────────────────────────────────────────────────────────────
VISUAL_SYSTEM_PROMPT = """Voce e um analista especializado em comunicacao politica e design grafico brasileira.
Analise a imagem fornecida em DUAS partes:

PARTE A — CONTEUDO E INTENCAO:
1. O que a imagem comunica (mensagem central, tese, posicionamento politico)
2. Quem produziu (identifique fonte, branding, gabinete, partido — ex: "gabinete do senador Flavio Bolsonaro")
3. Dados/numeros mostrados e como sao enfatizados visualmente (tamanho, cor, posicao)
4. Tom e tecnicas de persuasao/manipulacao emocional usadas
5. Publico-alvo inferido (quem essa imagem quer atingir)
6. Transcricao COMPLETA de todo texto visivel na imagem (incluindo logos, marcas d'agua, creditos)
7. Figuras politicas mencionadas ou mostradas, com alinhamento (esquerda/centro/direita) e posicao do autor (a favor/contra/neutro)

PARTE B — ESTRUTURA VISUAL (critica tecnica de design):
1. HIERARQUIA DE LAYOUT: o que e o elemento dominante, o que e secundario, o que e terciario. Se algo compete por atencao, diga explicitamente
2. TIPOGRAFIA: fontes usadas, tamanhos relativos (grande/medio/pequeno), cores de cada texto, enfases (negrito, italico, CAIXA ALTA, destaque colorido). Se algum texto esta pequeno demais ou grande demais, diga
3. PALETA DE CORES: cores dominantes, cores de destaque, clima visual (escuro/claro, quente/frio, contrastante/harmonico). Se alguma cor enfraquece ou fortalece a mensagem, diga
4. FOTO/IMAGEM: expressao facial da pessoa (se houver), angulo, iluminacao, recorte. A escolha de foto reforça ou enfraquece a mensagem?
5. ELEMENTOS GRAFICOS: setas, badges, logos, marcas d'agua, molduras, gradientes, sobreposicoes. O que funciona e o que polui
6. O QUE FUNCIONA BEM: liste 2-3 acertos visuais especificos (ex: "o numero em destaque gruda na memoria", "a cor vermelha no 'nao' reforça a negatividade")
7. O QUE MELHORAR: liste 3-5 sugestoes CONCRETAS e ACIONAVEIS (ex: "diminuir o 53% — ta competindo com a foto", "o logo do Poder360 ta perdido no meio — destacar como badge ou tirar", "colocar o nome do instituto embaixo como fonte credivel")

FORMATO DE RESPOSTA (JSON):
{
  "content_analysis": "Texto completo da Parte A, detalhado e rico",
  "visual_structure": "Texto completo da Parte B, com todas as sugestoes especificas",
  "core_point": "Frase curta: a tese central do autor",
  "political_figures": [{"nome": "Nome Completo", "alinhamento": "direita|centro-direita|centro|centro-esquerda|esquerda", "posicao_autor": "a favor|contra|neutro"}]
}

Se nao houver figuras politicas, use "political_figures": [].
Responda APENAS o JSON, sem markdown, sem code blocks."""

VIDEO_FRAMES_SYSTEM_PROMPT = """Voce e um analista especializado em comunicacao politica e design grafico brasileira.
Voce recebera FRAMES extraidos de um video politico (capturas de tela em momentos diferentes).

Analise TODOS os frames juntos para entender o video como um todo:

PARTE A — CONTEUDO E INTENCAO DO VIDEO:
1. O que o video comunica como um todo (mensagem central, narrativa, posicionamento)
2. Quem produziu (identifique fonte, canal, partido, gabinete)
3. Dados/numeros mostrados em qualquer frame
4. Tom geral e tecnicas de persuasao (cortes, graficos, texto sobreposto)
5. Publico-alvo inferido
6. Transcricao de textos visiveis nos frames (titulos, legendas, graficos, lower thirds)
7. Figuras politicas que aparecem ou sao mencionadas

PARTE B — ESTRUTURA VISUAL DO VIDEO:
1. IDENTIDADE VISUAL: paleta de cores do video, estilo grafico, consistencia visual entre frames
2. TEXTOS E LEGENDAS: fontes, tamanhos, cores, legibilidade em tela de celular
3. COMPOSICAO DOS FRAMES: enquadramento, uso de espaco, hierarquia visual em cada cena
4. GRAFICOS E DADOS: se mostram numeros/graficos, como sao apresentados (claro ou confuso?)
5. TRANSICOES: se da pra perceber pelos frames, como as cenas mudam (abrupto, suave)
6. O QUE FUNCIONA BEM: 2-3 acertos visuais
7. O QUE MELHORAR: 3-5 sugestoes concretas para a parte visual do video

FORMATO DE RESPOSTA (JSON):
{
  "content_analysis": "Texto completo da Parte A",
  "visual_structure": "Texto completo da Parte B",
  "core_point": "Frase curta: a tese central do video",
  "political_figures": [{"nome": "...", "alinhamento": "...", "posicao_autor": "..."}]
}

Responda APENAS o JSON, sem markdown."""


# ── Helpers ─────────────────────────────────────────────────────────────────
def _empty_result() -> dict[str, Any]:
    return {
        "content_analysis": "",
        "visual_structure": "",
        "core_point": "",
        "political_figures": [],
    }


def _parse_response(raw: str) -> dict[str, Any]:
    """Parse JSON from GPT response, stripping code fences if present."""
    clean = raw.strip()
    clean = clean.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end <= start:
        return _empty_result()
    try:
        return json.loads(clean[start:end + 1])
    except json.JSONDecodeError:
        return _empty_result()


# ── Image Analysis ──────────────────────────────────────────────────────────
async def analyze_image(
    image_data: str,
    image_type: str = "base64",
    mime_type: str = "image/jpeg",
) -> dict[str, Any]:
    """
    Analisa uma imagem com GPT-4o vision.

    Args:
        image_data: base64 string (sem prefix data:) OU URL http(s)
        image_type: "base64" ou "url"
        mime_type: MIME type da imagem (ex: "image/jpeg")

    Returns:
        {
            "content_analysis": str,
            "visual_structure": str,
            "core_point": str,
            "political_figures": list[dict],
        }
    """
    try:
        client = _get_client()

        if image_type == "url":
            image_content = {
                "type": "image_url",
                "image_url": {"url": image_data, "detail": "high"},
            }
        else:
            # base64
            data_url = f"data:{mime_type};base64,{image_data}"
            image_content = {
                "type": "image_url",
                "image_url": {"url": data_url, "detail": "high"},
            }

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.vision_model,
                max_tokens=settings.vision_max_tokens,
                messages=[
                    {"role": "system", "content": VISUAL_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analise esta imagem em detalhes:"},
                            image_content,
                        ],
                    },
                ],
            ),
            timeout=settings.vision_timeout,
        )

        raw = response.choices[0].message.content or ""
        result = _parse_response(raw)
        tokens_in = response.usage.prompt_tokens if response.usage else 0
        tokens_out = response.usage.completion_tokens if response.usage else 0
        print(f"[Visual] Image analyzed: content={len(result.get('content_analysis', ''))} chars, "
              f"structure={len(result.get('visual_structure', ''))} chars, "
              f"tokens={tokens_in}+{tokens_out}")
        return result

    except asyncio.TimeoutError:
        print(f"[Visual] Image analysis timed out ({settings.vision_timeout}s)")
        return _empty_result()
    except Exception as e:
        print(f"[Visual] Image analysis error: {e}")
        return _empty_result()


# ── Video Frame Extraction & Analysis ───────────────────────────────────────
async def extract_frames(video_path: str, num_frames: int = 4) -> list[str]:
    """
    Extrai N frames espaçados de um vídeo usando FFmpeg.
    Retorna lista de base64-encoded JPEGs.
    """
    frames: list[str] = []

    try:
        # Get video duration
        probe_cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            video_path,
        ]
        probe_result = await asyncio.to_thread(
            subprocess.run, probe_cmd,
            capture_output=True, text=True, timeout=10,
        )
        duration = 10.0  # fallback
        if probe_result.returncode == 0:
            probe_data = json.loads(probe_result.stdout)
            duration = float(probe_data.get("format", {}).get("duration", 10))

        # Calculate timestamps (skip first/last 5%)
        margin = duration * 0.05
        usable = duration - (2 * margin)
        if usable <= 0:
            timestamps = [duration / 2]
        else:
            step = usable / (num_frames - 1) if num_frames > 1 else 0
            timestamps = [margin + (step * i) for i in range(num_frames)]

        with tempfile.TemporaryDirectory() as tmp_dir:
            for i, ts in enumerate(timestamps):
                out_path = Path(tmp_dir) / f"frame_{i}.jpg"
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{ts:.2f}",
                    "-i", video_path,
                    "-vframes", "1",
                    "-q:v", "3",
                    "-vf", "scale='min(1024,iw)':-2",
                    out_path.as_posix(),
                ]
                result = await asyncio.to_thread(
                    subprocess.run, cmd,
                    capture_output=True, timeout=10,
                )
                if result.returncode == 0 and out_path.exists():
                    raw = out_path.read_bytes()
                    frames.append(base64.b64encode(raw).decode())

        print(f"[Visual] Extracted {len(frames)}/{num_frames} frames from video ({duration:.1f}s)")

    except Exception as e:
        print(f"[Visual] Frame extraction error: {e}")

    return frames


async def extract_and_analyze_frames(
    video_path: str,
    num_frames: int = 4,
) -> dict[str, Any]:
    """
    Extrai frames de um vídeo e analisa visualmente com GPT-4o.
    Todos os frames são enviados numa única chamada.
    """
    frames = await extract_frames(video_path, num_frames)
    if not frames:
        print("[Visual] No frames extracted — skipping video visual analysis")
        return _empty_result()

    try:
        client = _get_client()

        content: list[dict] = [
            {"type": "text", "text": f"Analise estes {len(frames)} frames de um video politico:"},
        ]
        for i, frame_b64 in enumerate(frames):
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{frame_b64}",
                    "detail": "high",
                },
            })

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.vision_model,
                max_tokens=settings.vision_max_tokens,
                messages=[
                    {"role": "system", "content": VIDEO_FRAMES_SYSTEM_PROMPT},
                    {"role": "user", "content": content},
                ],
            ),
            timeout=settings.vision_timeout * 2,  # more time for multiple frames
        )

        raw = response.choices[0].message.content or ""
        result = _parse_response(raw)
        tokens_in = response.usage.prompt_tokens if response.usage else 0
        tokens_out = response.usage.completion_tokens if response.usage else 0
        print(f"[Visual] Video frames analyzed: {len(frames)} frames, "
              f"content={len(result.get('content_analysis', ''))} chars, "
              f"tokens={tokens_in}+{tokens_out}")
        return result

    except asyncio.TimeoutError:
        print(f"[Visual] Video frame analysis timed out")
        return _empty_result()
    except Exception as e:
        print(f"[Visual] Video frame analysis error: {e}")
        return _empty_result()
