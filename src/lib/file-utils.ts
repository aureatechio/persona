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
 * Transcribe video via Python backend (FFmpeg audio extraction + Whisper).
 * Sends raw file as multipart FormData (no base64 overhead).
 * Retries once on transient 500 errors. Fails fast on 4xx (quota, bad request).
 * 60-second timeout per attempt.
 */
export async function transcribeVideoBackend(file: File): Promise<string | null> {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 60_000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch('/api/transcribe-video', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[transcribeVideo] Attempt ${attempt + 1} failed:`, res.status, errText.slice(0, 300));
        // Don't retry on 4xx (quota, bad request) — only on 500+ transient errors
        if (res.status < 500 || attempt >= MAX_RETRIES) return null;
        continue;
      }

      const json = await res.json();
      if (json.error) {
        console.warn(`[transcribeVideo] Backend error:`, json.error);
        return null;
      }

      console.log(`[transcribeVideo] OK — ${(file.size / (1024 * 1024)).toFixed(1)}MB → ${(json.transcript?.length || 0)} chars`);
      return json.transcript || '';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`[transcribeVideo] Timeout after ${TIMEOUT_MS / 1000}s (attempt ${attempt + 1})`);
      } else {
        console.warn(`[transcribeVideo] Network error (attempt ${attempt + 1}):`, err);
      }
      if (attempt >= MAX_RETRIES) return null;
    }
  }
  return null;
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
