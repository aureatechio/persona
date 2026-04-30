/**
 * Modal "latentsync" client.
 * Calls the deployed Modal function running ByteDance LatentSync.
 *
 * Endpoint URL is set in MODAL_LATENTSYNC_URL after deploy.
 */

const MODAL_LATENTSYNC_URL = process.env.MODAL_LATENTSYNC_URL || '';

interface LatentSyncResponse {
  video_url?: string;
  storage_path?: string;
  elapsed_seconds?: number;
  inference_steps?: number;
  guidance_scale?: number;
  error?: string;
}

export async function modalLatentSync(
  videoUrl: string,
  audioUrl: string,
  opts?: { inferenceSteps?: number; guidanceScale?: number; enableDeepcache?: boolean; timeoutMs?: number },
): Promise<{ videoUrl: string; elapsedSeconds: number; durationMs: number }> {
  if (!MODAL_LATENTSYNC_URL) throw new Error('MODAL_LATENTSYNC_URL não configurado');

  // v2 params: g=1.5 / steps=50 / deepcache=OFF — visually preferred in sweep F3
  // deepcache=ON saves time but produces unnatural black fill inside open mouth
  const timeoutMs = opts?.timeoutMs ?? 3_600_000; // 60 min — 50 steps sem deepcache
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(MODAL_LATENTSYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url:        videoUrl,
        audio_url:        audioUrl,
        inference_steps:  opts?.inferenceSteps  ?? 50,
        guidance_scale:   opts?.guidanceScale   ?? 1.5,
        enable_deepcache: opts?.enableDeepcache ?? false,
        normalize_fps:    true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Modal LatentSync ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as LatentSyncResponse;
    if (data.error) throw new Error(`Modal LatentSync: ${data.error}`);
    if (!data.video_url) throw new Error(`Modal LatentSync: missing video_url in response`);

    return {
      videoUrl: data.video_url,
      elapsedSeconds: data.elapsed_seconds ?? 0,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}
