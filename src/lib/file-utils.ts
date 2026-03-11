const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_WIDTH = 1200;
const IMAGE_QUALITY = 0.7;

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'url';
  file?: File;
  url?: string;
  preview?: string;
  name: string;
}

export interface ProcessedAttachment {
  type: 'image' | 'video' | 'url';
  data: string;
  name: string;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

export function canAddAttachment(current: Attachment[]): boolean {
  return current.length < MAX_ATTACHMENTS;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.round(height * (MAX_IMAGE_WIDTH / width));
        width = MAX_IMAGE_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/webp', IMAGE_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export async function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 120;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      // Center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/webp', 0.6));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Capture a thumbnail frame from a video file.
 * Seeks to 1 second, draws onto canvas, returns base64 WebP.
 */
export async function createVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);

    video.onloadeddata = () => {
      // Seek to 1s or 25% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.25);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const size = 160;
      const aspect = video.videoWidth / video.videoHeight;
      canvas.width = size;
      canvas.height = Math.round(size / aspect);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', 0.6);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };

    // Timeout fallback
    setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Video thumbnail timeout'));
    }, 8000);

    video.src = url;
  });
}

/**
 * Transcribe video via Digital Ocean Python backend.
 * Flow: Browser → Supabase Storage → DO downloads by URL → FFmpeg → Whisper → transcript
 * Zero Vercel involvement — no body size limits, no function timeouts.
 */
export async function transcribeVideoBackend(file: File): Promise<string | null> {
  const TIMEOUT_MS = 90_000;
  const BACKEND = process.env.NEXT_PUBLIC_ARENA_BACKEND_URL || 'https://arena-analysis-api-2puat.ondigitalocean.app';

  // Dynamic import to avoid SSR issues
  const { supabase } = await import('@/lib/supabase');

  const ext = file.name.split('.').pop() || 'webm';
  const storagePath = `temp-transcriptions/${crypto.randomUUID()}.${ext}`;

  try {
    // 1. Get signed upload URL (bypasses Vercel 4.5MB limit)
    console.log(`[transcribeVideo] Uploading ${(file.size / (1024 * 1024)).toFixed(1)}MB to Supabase...`);
    const { data: uploadData, error: uploadError } = await supabase
      .storage.from('voice-models')
      .createSignedUploadUrl(storagePath);

    if (uploadError || !uploadData) {
      console.error('[transcribeVideo] Failed to create upload URL:', uploadError);
      return null;
    }

    // 2. Upload directly to Supabase Storage (browser → Supabase, no Vercel)
    const uploadRes = await fetch(uploadData.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/webm' },
      body: file,
    });

    if (!uploadRes.ok) {
      console.error('[transcribeVideo] Upload failed:', uploadRes.status);
      return null;
    }
    console.log('[transcribeVideo] Upload OK');

    // 3. Get signed download URL for DO to fetch (5 min expiry)
    const { data: signedData, error: signedError } = await supabase
      .storage.from('voice-models')
      .createSignedUrl(storagePath, 300);

    if (signedError || !signedData?.signedUrl) {
      console.error('[transcribeVideo] Failed to create signed URL:', signedError);
      return null;
    }

    // 4. Call DO directly with the Supabase URL (no Vercel proxy)
    console.log('[transcribeVideo] Sending to DO for transcription...');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${BACKEND}/api/transcribe-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: signedData.signedUrl,
        filename: file.name,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[transcribeVideo] DO error:', res.status, errText.slice(0, 300));
      return null;
    }

    const json = await res.json();
    if (json.error) {
      console.warn('[transcribeVideo] Backend error:', json.error);
      return null;
    }

    console.log(`[transcribeVideo] OK — ${(file.size / (1024 * 1024)).toFixed(1)}MB → ${(json.transcript?.length || 0)} chars`);
    return json.transcript || '';
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[transcribeVideo] Timeout after ${TIMEOUT_MS / 1000}s`);
    } else {
      console.warn('[transcribeVideo] Error:', err);
    }
    return null;
  } finally {
    // 5. Cleanup: delete temp file from Supabase (fire-and-forget)
    supabase.storage.from('voice-models').remove([storagePath]).catch(() => {});
  }
}

export async function processAttachmentsForUpload(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
  const results: ProcessedAttachment[] = [];

  for (const att of attachments) {
    if (att.type === 'url' && att.url) {
      results.push({ type: 'url', data: att.url, name: att.name });
    } else if (att.type === 'image' && att.file) {
      const base64 = await compressImage(att.file);
      results.push({ type: 'image', data: base64, name: att.name });
    } else if (att.type === 'video' && att.file) {
      // Transcribe via Python backend (Whisper)
      // null = transcription failed, '' = no speech, string = transcript
      const transcript = await transcribeVideoBackend(att.file);
      if (transcript === null) {
        // Transcription failed — mark with special prefix so analyze-media knows
        results.push({ type: 'video', data: '__TRANSCRIPTION_FAILED__', name: att.name });
      } else {
        results.push({ type: 'video', data: transcript, name: att.name });
      }
    }
  }

  return results;
}
