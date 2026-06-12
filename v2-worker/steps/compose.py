"""V2 Step 5: normalize + crossfade join + trilha contínua + concatenate."""

import subprocess
import tempfile
import os
import logging
import json

import requests

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger("v2-worker.compose")

FFMPEG_TIMEOUT = 600  # seconds (10 min — large videos on small instances need time)

# Closing video + music (downloaded from Supabase Storage)
# These are DEFAULTS used when a base_model has closing_video_path = NULL.
DEFAULT_CLOSING_VIDEO_PATH = "assets/closing_video.mp4"
DEFAULT_CLOSING_MUSIC_PATH = "assets/closing_music.mp3"
CLOSING_MUSIC_VOLUME = 0.5  # 50% volume for background music on closing

# Junção name_sync → theme_video (fluxo novo)
XFADE_DURATION = 0.3  # crossfade de vídeo E áudio entre os middles
MIDDLE_MUSIC_VOLUME = 0.25  # trilha contínua sob name_sync + theme
MIDDLE_MUSIC_FADEOUT = 2.0  # fade-out da trilha antes do closing

# Loudness alvo (EBU R128) — TTS de estúdio e gravação de câmera saem
# com volumes muito diferentes; sem normalizar, a junção dá um salto
# de volume perceptível.
LOUDNORM_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11"

# Params de encode compartilhados entre _normalize e o join com xfade —
# precisam ser idênticos pro concat final rodar com -c copy.
ENC_ARGS = [
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-r", "30", "-video_track_timescale", "15360",
    "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
]

# Cache of downloaded assets, keyed by storage path. Replaces the old
# globals (_closing_video_cache / _closing_music_cache) so we can cache
# multiple closing videos simultaneously (one per politician).
_asset_cache: dict[str, bytes] = {}


def _download_storage_asset(path: str) -> bytes | None:
    """Download an asset from Supabase Storage (cached by path)."""
    if path in _asset_cache:
        return _asset_cache[path]
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/voice-models/{path}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        logger.info("Downloaded %s: %d bytes", path, len(resp.content))
        _asset_cache[path] = resp.content
        return resp.content
    except Exception as e:
        logger.warning("Failed to download %s: %s", path, e)
        return None


def _run_ffmpeg(args: list[str]):
    """Run ffmpeg with args, raise on failure."""
    cmd = ["ffmpeg"] + args
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"FFmpeg failed (rc={result.returncode}): {stderr}")


def _get_duration(file_path: str) -> float:
    """Duration in seconds via ffprobe (0.0 on failure)."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                file_path,
            ],
            capture_output=True,
            timeout=15,
        )
        if result.returncode != 0:
            return 0.0
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0.0))
    except Exception as e:
        logger.warning("ffprobe duration failed for %s: %s", file_path, e)
        return 0.0


def speech_silences(video_path: str, max_seconds: float = 10.0, noise_db: int = -25, min_dur: float = 0.15) -> list[tuple[float, float]]:
    """Pausas de fala [(início, fim), ...] nos primeiros ``max_seconds``
    de uma mídia local (silencedetect)."""
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-t", f"{max_seconds:.1f}", "-i", video_path,
                "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
                "-f", "null", "-",
            ],
            capture_output=True,
            timeout=120,
        )
        import re as _re
        out = result.stderr.decode(errors="replace")
        starts = [float(m) for m in _re.findall(r"silence_start: ([0-9.]+)", out)]
        ends = [float(m) for m in _re.findall(r"silence_end: ([0-9.]+)", out)]
        return list(zip(starts, ends))
    except Exception as e:
        logger.warning("speech_silences failed for %s: %s", video_path, e)
        return []


def _cap_trailing_silence(input_path: str, keep: float = 0.35, noise_db: int = -38) -> str:
    """
    Corta o clipe logo após a fala terminar, mantendo só ``keep``s de
    silêncio final. O TTS varia de duração e pode trazer respiração ou
    ruído no rabo — sem este corte, o clipe do nome fica "parado" por
    tempo variável antes da transição. Medindo o fim REAL da fala, a
    transição cai sempre logo depois da última palavra, independente
    da duração que o TTS gerou. Retorna o path (novo ou o original).
    """
    dur = _get_duration(input_path)
    if dur <= 0:
        return input_path
    silences = speech_silences(input_path, max_seconds=dur + 1.0, noise_db=noise_db, min_dur=0.1)
    # Silêncio final = o último que se estende até (quase) o fim do clipe
    trailing_start = None
    for s_start, s_end in silences:
        if s_end >= dur - 0.1:
            trailing_start = s_start
    if trailing_start is None or (dur - trailing_start) <= keep + 0.05:
        return input_path

    new_dur = trailing_start + keep
    out_path = input_path.replace(".mp4", "_capped.mp4")
    _run_ffmpeg([
        "-i", input_path, "-t", f"{new_dur:.3f}",
        *ENC_ARGS,
        "-movflags", "+faststart", "-y", out_path,
    ])
    logger.info(
        "Trailing silence capped: %.2fs → %.2fs (fala termina em %.2fs, keep=%.2fs)",
        dur, new_dur, trailing_start, keep,
    )
    return out_path


def scene_cut_times(video_path: str, max_seconds: float = 10.0, threshold: float = 0.12) -> list[float]:
    """
    Detecta cortes de cena (trocas de ângulo/take) nos primeiros
    ``max_seconds`` de um vídeo local. Usado pra achar a janela de
    ângulo único da intro do theme_video — o lipsync do nome não pode
    atravessar um corte de câmera (aparece "dois takes" na mesma fala).

    Limiar 0.12: cortes entre takes do MESMO enquadramento são suaves
    (no seguranca_crime_organizado o corte de 1.0s não passava de 0.20)
    — 0.25 só pegava trocas de ângulo fortes.
    """
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-t", f"{max_seconds:.1f}", "-i", video_path,
                "-vf", f"select='gt(scene,{threshold})',metadata=print",
                "-an", "-f", "null", "-",
            ],
            capture_output=True,
            timeout=120,
        )
        import re as _re
        out = result.stderr.decode(errors="replace")
        return [float(m) for m in _re.findall(r"pts_time:([0-9.]+)", out)]
    except Exception as e:
        logger.warning("scene_cut_times failed for %s: %s", video_path, e)
        return []


def media_duration_bytes(data: bytes, suffix: str = ".mp4") -> float:
    """Duração (s) de uma mídia em memória. 0.0 em falha."""
    tmpdir = tempfile.mkdtemp(prefix="dur_")
    path = os.path.join(tmpdir, f"media{suffix}")
    try:
        with open(path, "wb") as f:
            f.write(data)
        return _get_duration(path)
    finally:
        try:
            os.unlink(path)
            os.rmdir(tmpdir)
        except OSError:
            pass


def trim_video_bytes(video_bytes: bytes, start: float, duration: float) -> bytes:
    """
    Recorta [start : start+duration] de um vídeo, re-encodando do frame
    exato (-ss depois do -i = corte preciso, sem o freeze inicial do
    fast-seek por keyframe). Usado pra extrair a janela de ângulo único
    do theme_video que serve de base visual pro lipsync do nome.
    """
    tmpdir = tempfile.mkdtemp(prefix="trim_")
    src = os.path.join(tmpdir, "src.mp4")
    out = os.path.join(tmpdir, "out.mp4")
    try:
        with open(src, "wb") as f:
            f.write(video_bytes)
        _run_ffmpeg([
            "-i", src, "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k",
            "-y", out,
        ])
        with open(out, "rb") as f:
            return f.read()
    finally:
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


def _has_audio_stream(file_path: str) -> bool:
    """Check if a media file has an audio stream using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_streams", "-select_streams", "a",
                file_path,
            ],
            capture_output=True,
            timeout=15,
        )
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        return len(data.get("streams", [])) > 0
    except Exception as e:
        logger.warning("ffprobe check failed for %s: %s", file_path, e)
        return False


def _normalize(input_path: str, output_path: str, start_offset: float = 0.0):
    """
    Normalize a video to 720x1280 30fps h264+aac. Se start_offset > 0,
    o ffmpeg recebe -ss antes do -i pra pular os primeiros N segundos
    (fast seek por keyframe — usado pra cortar a intro neutra do
    theme_video no fluxo name_sync).
    """
    has_audio = _has_audio_stream(input_path)
    logger.info(
        "Normalizing %s (has_audio=%s, start_offset=%.2fs)...",
        os.path.basename(input_path), has_audio, start_offset,
    )

    seek_args = ["-ss", f"{start_offset:.3f}"] if start_offset > 0 else []

    # "cover": escala pra preencher 720x1280 e corta as bordas excedentes.
    # force_original_aspect_ratio=increase garante que nenhum eixo fique
    # menor que o alvo antes do crop — sem barras pretas, ocupa tela cheia.
    # yuv420p obrigatório para compatibilidade máxima com concat -c copy.
    _VF = (
        "scale=720:1280:force_original_aspect_ratio=increase,"
        "crop=720:1280,"
        "setsar=1"
    )

    if has_audio:
        _run_ffmpeg([
            *seek_args, "-i", input_path,
            *ENC_ARGS,
            "-vf", _VF,
            "-af", LOUDNORM_FILTER,
            "-movflags", "+faststart", "-y", output_path,
        ])
    else:
        # Generate silent audio to match video duration (sem loudnorm —
        # normalizar silêncio digital não faz sentido)
        _run_ffmpeg([
            *seek_args, "-i", input_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            *ENC_ARGS,
            "-vf", _VF,
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", output_path,
        ])

    # Verify output has audio
    if not _has_audio_stream(output_path):
        logger.warning("Normalized output %s still has no audio — adding silent track", os.path.basename(output_path))
        temp_out = output_path + ".tmp.mp4"
        _run_ffmpeg([
            "-i", output_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", temp_out,
        ])
        os.replace(temp_out, output_path)


def _prepare_closing_video(
    tmpdir: str,
    video_storage_path: str,
    music_storage_path: str,
) -> str | None:
    """
    Prepare closing video with background music overlay.
    Downloads the given closing video and music from Storage (cached by path),
    mixes music at CLOSING_MUSIC_VOLUME with a short fade-in, and normalizes
    to match the selfie/lipsync format.

    The music is cut by ``-shortest`` when the video ends (no fade-out),
    which works cleanly for closings of any duration (3s, 10s, etc).

    Returns path to normalized closing video, or None on failure.
    """
    closing_bytes = _download_storage_asset(video_storage_path)
    if closing_bytes is None:
        logger.warning("No closing video available at %s, skipping", video_storage_path)
        return None

    closing_raw = os.path.join(tmpdir, "closing_raw.mp4")
    closing_norm = os.path.join(tmpdir, "closing_norm.mp4")

    with open(closing_raw, "wb") as f:
        f.write(closing_bytes)

    # Mix background music into closing video
    music_bytes = _download_storage_asset(music_storage_path)
    if music_bytes is not None:
        music_path = os.path.join(tmpdir, "closing_music.mp3")
        closing_with_music = os.path.join(tmpdir, "closing_music_mixed.mp4")

        with open(music_path, "wb") as f:
            f.write(music_bytes)

        try:
            # Replace closing video audio entirely with music track.
            # Fade-in only; -shortest cuts the music when the video ends.
            _run_ffmpeg([
                "-i", closing_raw, "-i", music_path,
                "-filter_complex",
                f"[1:a]volume={CLOSING_MUSIC_VOLUME},afade=t=in:d=0.5[music]",
                "-map", "0:v", "-map", "[music]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                "-shortest",
                "-y", closing_with_music,
            ])
            closing_raw = closing_with_music
            logger.info("Closing music mixed successfully")
        except Exception as e:
            logger.warning("Failed to mix closing music: %s — using original audio", e)

    _normalize(closing_raw, closing_norm)
    return closing_norm


def _join_middles_crossfade(
    tmpdir: str,
    part_paths: list[str],
    bg_music_path: str | None = None,
) -> str:
    """
    Junta os middles normalizados (name_sync + theme_video) em um único
    clipe com crossfade de vídeo (xfade) e de áudio (acrossfade) de
    XFADE_DURATION segundos — substitui o corte seco do concat na junção.

    Se ``bg_music_path`` for informado, mixa a música como trilha
    CONTÍNUA atravessando a junção (fade-in de 0.5s, fade-out de
    MIDDLE_MUSIC_FADEOUT antes do closing). Antes a música vinha baked
    no TTS do name_sync e morria em corte seco na transição.

    Sai com os mesmos params de encode do _normalize, então o concat
    final continua válido com -c copy.
    """
    if len(part_paths) < 2:
        raise ValueError("_join_middles_crossfade requer >= 2 partes")

    # Clipe do nome (parte 0): corta logo após a fala terminar — a
    # transição sempre cai depois da última palavra, qualquer que seja
    # a duração que o TTS gerou.
    part_paths = list(part_paths)
    part_paths[0] = _cap_trailing_silence(part_paths[0])

    durations = [_get_duration(p) for p in part_paths]
    if any(d <= XFADE_DURATION for d in durations):
        raise RuntimeError(
            f"join_middles: clipe mais curto que o crossfade (durations={durations})"
        )

    out_path = os.path.join(tmpdir, "middle_joined.mp4")

    inputs: list[str] = []
    for p in part_paths:
        inputs += ["-i", p]

    # Vídeo: cadeia de xfade — cada junção começa XFADE_DURATION antes
    # do fim acumulado dos clipes anteriores.
    #
    # Áudio: SEM acrossfade. O fade atenuava a primeira palavra do tema
    # e sobrepunha o fim da fala do nome ("fala dobrada"/fora de sync).
    # Cada áudio entra alinhado ao seu vídeo (adelay até o início do
    # clipe na timeline) em volume cheio; a sobreposição de 0.3s cai no
    # tail silence do clipe anterior (por isso o TTS do name_sync leva
    # respiro >= XFADE_DURATION).
    n = len(part_paths)
    filters: list[str] = []
    v_prev = "[0:v]"
    offset = 0.0
    a_labels = ["[0:a]"]
    for i in range(1, n):
        offset += durations[i - 1] - XFADE_DURATION
        filters.append(
            f"{v_prev}[{i}:v]xfade=transition=fade"
            f":duration={XFADE_DURATION}:offset={offset:.3f}[v{i}]"
        )
        delay_ms = int(round(offset * 1000))
        filters.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[ad{i}]")
        a_labels.append(f"[ad{i}]")
        v_prev = f"[v{i}]"
    filters.append(
        "".join(a_labels) + f"amix=inputs={n}:normalize=0:duration=longest[amain]"
    )
    a_prev = "[amain]"

    total = sum(durations) - XFADE_DURATION * (n - 1)

    music_bytes = _download_storage_asset(bg_music_path) if bg_music_path else None
    if music_bytes is not None:
        music_path = os.path.join(tmpdir, "middle_music.mp3")
        with open(music_path, "wb") as f:
            f.write(music_bytes)
        music_idx = len(part_paths)
        inputs += ["-stream_loop", "-1", "-i", music_path]
        fade_start = max(0.0, total - MIDDLE_MUSIC_FADEOUT)
        filters.append(
            f"[{music_idx}:a]volume={MIDDLE_MUSIC_VOLUME},"
            f"afade=t=in:d=0.5,"
            f"afade=t=out:st={fade_start:.3f}:d={MIDDLE_MUSIC_FADEOUT}[bg]"
        )
        # normalize=0: sem atenuação automática do amix — volumes já
        # foram definidos explicitamente (voz com loudnorm, música a
        # MIDDLE_MUSIC_VOLUME). duration=first corta o loop infinito
        # da música quando a voz acaba.
        filters.append(f"{a_prev}[bg]amix=inputs=2:duration=first:normalize=0[aout]")
        a_prev = "[aout]"

    _run_ffmpeg([
        *inputs,
        "-filter_complex", ";".join(filters),
        "-map", v_prev, "-map", a_prev,
        *ENC_ARGS,
        "-movflags", "+faststart", "-y", out_path,
    ])
    logger.info(
        "Middles joined: %d parts (%s), xfade=%.1fs, music=%s, total=%.1fs",
        len(part_paths), ["%.1fs" % d for d in durations],
        XFADE_DURATION, bool(music_bytes), total,
    )
    return out_path


def _mix_body_music(tmpdir: str, body_path: str, bg_music_path: str) -> str:
    """
    Mixa uma trilha instrumental contínua por BAIXO do corpo (selfie +
    name_sync + theme_video). A música é loopada pra cobrir toda a
    duração, entra com fade-in de 0.5s e some com fade-out antes do fim
    (onde começa o closing, que tem trilha própria). O áudio original do
    corpo é preservado — a música só entra por baixo num volume baixo.

    Retorna o path do corpo com música; se a música falhar, devolve o
    body_path original (degrada sem quebrar o vídeo).
    """
    music_bytes = _download_storage_asset(bg_music_path)
    if music_bytes is None:
        logger.warning("Trilha %s indisponível — corpo sem música de fundo", bg_music_path)
        return body_path

    body_dur = _get_duration(body_path)
    if body_dur <= 0:
        logger.warning("Não consegui medir o corpo — pulando trilha de fundo")
        return body_path

    music_path = os.path.join(tmpdir, "body_music.mp3")
    with open(music_path, "wb") as f:
        f.write(music_bytes)

    out_path = os.path.join(tmpdir, "body_with_music.mp4")
    fade_start = max(0.0, body_dur - MIDDLE_MUSIC_FADEOUT)

    try:
        _run_ffmpeg([
            "-i", body_path,
            "-stream_loop", "-1", "-i", music_path,
            "-filter_complex",
            f"[1:a]volume={MIDDLE_MUSIC_VOLUME},"
            f"afade=t=in:d=0.5,"
            f"afade=t=out:st={fade_start:.3f}:d={MIDDLE_MUSIC_FADEOUT}[bg];"
            f"[0:a][bg]amix=inputs=2:duration=first:normalize=0[aout]",
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-movflags", "+faststart", "-y", out_path,
        ])
        logger.info(
            "Trilha contínua mixada sob o corpo (%.1fs, vol=%.2f, fade-out em %.1fs)",
            body_dur, MIDDLE_MUSIC_VOLUME, fade_start,
        )
        return out_path
    except Exception as e:
        logger.warning("Falha ao mixar trilha do corpo (%s) — corpo sem música", e)
        return body_path


def compose_videos(
    selfie_bytes: bytes,
    selfie_ext: str,
    middle_urls: str | list[str],
    closing_video_path: str | None = None,
    closing_music_path: str | None = None,
    middle_offsets: list[float] | None = None,
    bg_music_path: str | None = None,
) -> bytes:
    """
    Baixa todos os "vídeos do meio", normaliza tudo e concatena na ordem:

        selfie + middle[0] + middle[1] + ... + closing

    ``middle_urls`` pode ser uma string (lipsync único — fluxo antigo) ou
    uma lista (fluxo novo: ``[name_sync_url, theme_video_url]``). Cada
    URL pode ser do Sync.so, signed URL do Supabase Storage ou qualquer
    HTTP que retorne mp4.

    ``middle_offsets`` (opcional) — lista de segundos a pular no início
    de cada middle. Usado no fluxo name_sync pra cortar a intro neutra
    do theme_video (que foi substituída pelo name_sync). Se omitido,
    todos começam do segundo 0.

    ``closing_video_path`` / ``closing_music_path`` sobrescrevem os
    defaults — quando None, cai nos assets globais.

    ``bg_music_path`` (fluxo novo apenas) — trilha instrumental contínua
    mixada por baixo do CORPO inteiro (selfie + name_sync + theme_video),
    atravessando todas as junções pra mascarar as trocas de vídeo. O áudio
    original de cada parte (fala do eleitor, voz do nome, voz do tema) é
    preservado; a música entra por baixo num volume baixo, com fade-in no
    começo e fade-out antes do closing (que tem trilha própria). No fluxo
    legacy a música já vem mixada dentro do TTS, então é ignorada.

    Retorna o MP4 final em bytes.
    """
    if isinstance(middle_urls, str):
        middle_urls = [middle_urls]
    middle_urls = [u for u in middle_urls if u]
    if not middle_urls:
        raise ValueError("compose_videos: middle_urls vazio")

    tmpdir = tempfile.mkdtemp(prefix="v2_compose_")
    selfie_path = os.path.join(tmpdir, f"selfie.{selfie_ext}")
    selfie_norm = os.path.join(tmpdir, "selfie_norm.mp4")
    concat_list = os.path.join(tmpdir, "concat.txt")
    output_path = os.path.join(tmpdir, "final.mp4")

    try:
        # 1. Selfie do eleitor
        with open(selfie_path, "wb") as f:
            f.write(selfie_bytes)
        _normalize(selfie_path, selfie_norm)

        # 2. Baixa e normaliza cada middle part (name_sync, theme_video, ...)
        middle_norms: list[str] = []
        for idx, url in enumerate(middle_urls):
            raw_path = os.path.join(tmpdir, f"middle_{idx}.mp4")
            norm_path = os.path.join(tmpdir, f"middle_{idx}_norm.mp4")
            logger.info("Downloading middle[%d] from %s...", idx, url[:80])
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            with open(raw_path, "wb") as f:
                f.write(resp.content)
            logger.info("middle[%d] downloaded: %d bytes", idx, len(resp.content))
            offset = (
                middle_offsets[idx]
                if middle_offsets and idx < len(middle_offsets)
                else 0.0
            )
            _normalize(raw_path, norm_path, start_offset=offset)
            middle_norms.append(norm_path)

        # 2b. Fluxo novo (>= 2 middles): junta name_sync + theme_video
        # com crossfade de vídeo/áudio, virando um único "middle".
        # Fluxo legacy (1 middle) segue direto. A música NÃO entra aqui —
        # ela é mixada depois por baixo do corpo inteiro (selfie incluso).
        if len(middle_norms) >= 2:
            middle_norms = [
                _join_middles_crossfade(tmpdir, middle_norms, bg_music_path=None)
            ]

        # 3. Corpo = selfie + middles (concat -c copy; todos já normalizados
        # pros mesmos params). A trilha contínua entra por baixo dele.
        body_concat = os.path.join(tmpdir, "body_concat.txt")
        body_path = os.path.join(tmpdir, "body.mp4")
        with open(body_concat, "w") as f:
            f.write(f"file '{selfie_norm}'\n")
            for m in middle_norms:
                f.write(f"file '{m}'\n")
        _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", body_concat,
            "-c", "copy", "-movflags", "+faststart", "-y", body_path,
        ])

        # 3b. Trilha instrumental contínua por baixo do corpo inteiro —
        # atravessa selfie→name→theme mascarando as trocas de vídeo.
        if bg_music_path:
            body_path = _mix_body_music(tmpdir, body_path, bg_music_path)

        # 4. Closing (trilha própria — não recebe o bed contínuo)
        closing_norm = _prepare_closing_video(
            tmpdir,
            video_storage_path=closing_video_path or DEFAULT_CLOSING_VIDEO_PATH,
            music_storage_path=closing_music_path or DEFAULT_CLOSING_MUSIC_PATH,
        )

        # 5. Concat final: corpo (com trilha) + closing
        logger.info("Concatenating body + closing=%s...", bool(closing_norm))
        with open(concat_list, "w") as f:
            f.write(f"file '{body_path}'\n")
            if closing_norm:
                f.write(f"file '{closing_norm}'\n")

        _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy",
            "-movflags", "+faststart",
            "-y", output_path,
        ])

        with open(output_path, "rb") as f:
            final_bytes = f.read()

        logger.info("Final video: %d bytes", len(final_bytes))
        return final_bytes

    finally:
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass
