import jwt from 'jsonwebtoken';

// ============ CONFIG ============
const LIPSYNC_PROVIDER = process.env.LIPSYNC_PROVIDER || 'kling';

// Sync Labs
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';

// Kling AI
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || '';
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || '';
const KLING_API_BASE = 'https://api.klingai.com';

// ============ TYPES ============
export interface LipsyncSubmitResult {
  jobId: string;
}

export interface LipsyncPollResult {
  status: 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
}

// ============ KLING JWT ============
function generateKlingToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: KLING_ACCESS_KEY,
      exp: now + 1800, // 30 min
      nbf: now - 5,
      iat: now,
    },
    KLING_SECRET_KEY,
    { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } }
  );
}

// ============ SYNC LABS ============
async function syncSubmit(videoUrl: string, audioUrl: string): Promise<LipsyncSubmitResult> {
  if (!SYNC_API_KEY) throw new Error('SYNC_API_KEY não configurado');

  const res = await fetch('https://api.sync.so/v2/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SYNC_API_KEY,
    },
    body: JSON.stringify({
      model: 'lipsync-2-pro',
      input: [
        { type: 'video', url: videoUrl },
        { type: 'audio', url: audioUrl },
      ],
      options: { sync_mode: 'cut_off' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sync Labs submit failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  console.log('[lipsync:sync] Job submitted:', data.id);
  return { jobId: data.id };
}

async function syncPoll(jobId: string): Promise<LipsyncPollResult> {
  if (!SYNC_API_KEY) throw new Error('SYNC_API_KEY não configurado');

  const res = await fetch(`https://api.sync.so/v2/generate/${jobId}`, {
    headers: { 'x-api-key': SYNC_API_KEY },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sync Labs poll failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  console.log('[lipsync:sync] Poll status:', data.status);

  if (data.status === 'COMPLETED' && data.outputUrl) {
    return { status: 'completed', outputUrl: data.outputUrl };
  }

  if (data.status === 'FAILED' || data.status === 'REJECTED') {
    return { status: 'failed', error: data.error || `Sync Labs job ${data.status}` };
  }

  return { status: 'processing' };
}

// ============ KLING AI ============
async function klingSubmit(videoUrl: string, audioUrl: string): Promise<LipsyncSubmitResult> {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error('KLING_ACCESS_KEY ou KLING_SECRET_KEY não configurados');
  }

  const token = generateKlingToken();

  const res = await fetch(`${KLING_API_BASE}/v1/videos/lip-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        mode: 'audio2video',
        video_url: videoUrl,
        audio_type: 'url',
        audio_url: audioUrl,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kling submit failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling submit error: ${data.message || JSON.stringify(data)}`);
  }

  const taskId = data.data?.task_id;
  if (!taskId) {
    throw new Error(`Kling submit: no task_id in response: ${JSON.stringify(data)}`);
  }

  console.log('[lipsync:kling] Job submitted:', taskId);
  return { jobId: taskId };
}

async function klingPoll(jobId: string): Promise<LipsyncPollResult> {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error('KLING_ACCESS_KEY ou KLING_SECRET_KEY não configurados');
  }

  const token = generateKlingToken();

  const res = await fetch(`${KLING_API_BASE}/v1/videos/lip-sync/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kling poll failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling poll error: ${data.message || JSON.stringify(data)}`);
  }

  const taskStatus = data.data?.task_status;
  console.log('[lipsync:kling] Poll status:', taskStatus);

  if (taskStatus === 'succeed') {
    const videoUrl = data.data?.task_result?.videos?.[0]?.url;
    if (videoUrl) {
      return { status: 'completed', outputUrl: videoUrl };
    }
    return { status: 'failed', error: 'Kling completed but no video URL in response' };
  }

  if (taskStatus === 'failed') {
    const errMsg = data.data?.task_status_msg || 'Kling job failed';
    return { status: 'failed', error: errMsg };
  }

  // submitted, processing, etc.
  return { status: 'processing' };
}

// ============ PUBLIC API ============
export function getLipsyncProvider(): string {
  return LIPSYNC_PROVIDER;
}

export async function submitLipsyncJob(videoUrl: string, audioUrl: string): Promise<LipsyncSubmitResult> {
  console.log(`[lipsync] Provider: ${LIPSYNC_PROVIDER}`);

  if (LIPSYNC_PROVIDER === 'sync') {
    return syncSubmit(videoUrl, audioUrl);
  }

  return klingSubmit(videoUrl, audioUrl);
}

export async function pollLipsyncJob(jobId: string): Promise<LipsyncPollResult> {
  if (LIPSYNC_PROVIDER === 'sync') {
    return syncPoll(jobId);
  }

  return klingPoll(jobId);
}
