/**
 * Cliente do pipeline orquestrado de lipsync.
 * Encadeia: audio_preprocess (F1) → LatentSync → face_refine (F4)
 *
 * Preferir este client ao modalLatentSync em produção quando qualidade máxima for necessária.
 * Endpoint: MODAL_PIPELINE_URL (sync-otimizado/modal/pipeline_app.py)
 */

const MODAL_PIPELINE_URL = process.env.MODAL_PIPELINE_URL || '';

interface PipelineStepInfo {
  elapsed_seconds?: number;
  size_mb?: number;
  storage_path?: string;
  input_fps?: number;
  fps_normalized_to_25?: boolean;
  fidelity_weight?: number;
  filter_chain?: string;
}

interface PipelineResponse {
  video_url?: string;
  storage_path?: string;
  elapsed_seconds?: number;
  steps_run?: string[];
  steps?: Record<string, PipelineStepInfo>;
  error?: string;
  failed_step?: string;
}

export interface PipelineOpts {
  // Etapas
  audioPreprocess?: boolean;   // default true  — F1: denoise + EQ + loudnorm
  faceRefine?: boolean;        // default true  — F4: CodeFormer face restoration
  rife?: boolean;              // default false — F5: frame interpolation 25→30fps (opt-in)
  rifeTargetFps?: number;      // default 30
  // Params LatentSync (v2 visual champion do sweep F3)
  inferenceSteps?: number;     // default 50
  guidanceScale?: number;      // default 1.5
  enableDeepcache?: boolean;   // default false (deepcache=ON causa boca preta em abertura)
  // Params face refine
  fidelityWeight?: number;     // default 0.7 (0=restauração máxima, 1=original)
  // Timeout
  timeoutMs?: number;          // default 3_600_000 (60 min)
}

export async function modalPipeline(
  videoUrl: string,
  audioUrl: string,
  opts?: PipelineOpts,
): Promise<{ videoUrl: string; storagePath: string; elapsedSeconds: number; stepsRun: string[] }> {
  if (!MODAL_PIPELINE_URL) throw new Error('MODAL_PIPELINE_URL não configurado');

  const timeoutMs = opts?.timeoutMs ?? 3_600_000;
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(MODAL_PIPELINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url:        videoUrl,
        audio_url:        audioUrl,
        audio_preprocess:  opts?.audioPreprocess ?? true,
        face_refine:       opts?.faceRefine      ?? true,
        rife:              opts?.rife             ?? false,
        rife_target_fps:   opts?.rifeTargetFps    ?? 30,
        latentsync: {
          guidance_scale:   opts?.guidanceScale   ?? 1.5,
          inference_steps:  opts?.inferenceSteps  ?? 50,
          enable_deepcache: opts?.enableDeepcache ?? false,
          normalize_fps:    true,
        },
        face_refine_config: {
          fidelity_weight: opts?.fidelityWeight ?? 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Modal Pipeline ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as PipelineResponse;
    if (data.error) throw new Error(`Modal Pipeline [${data.failed_step}]: ${data.error}`);
    if (!data.video_url) throw new Error('Modal Pipeline: missing video_url in response');

    return {
      videoUrl:       data.video_url,
      storagePath:    data.storage_path ?? '',
      elapsedSeconds: data.elapsed_seconds ?? 0,
      stepsRun:       data.steps_run ?? [],
    };
  } finally {
    clearTimeout(timer);
  }
}
