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

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url);
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const MAX_TRANSCRIPT_CHARS = 10_000;

/**
 * Try fetching YouTube transcript directly from the browser (residential IP).
 * Falls back to server-side route, then to oEmbed metadata.
 */
async function fetchYouTubeTranscript(url: string): Promise<{ transcript: string; title: string; author: string } | null> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  // Strategy 1: Client-side innertube call (browser IP = residential, not blocked)
  try {
    const playerRes = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId,
        }),
      },
    );

    if (playerRes.ok) {
      const playerData = await playerRes.json();
      const playStatus = playerData?.playabilityStatus?.status;

      if (playStatus === 'OK' || !playStatus) {
        const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (captions && captions.length > 0) {
          const track =
            captions.find((c: any) => c.languageCode === 'pt') ||
            captions.find((c: any) => c.languageCode === 'pt-BR') ||
            captions.find((c: any) => c.languageCode === 'en') ||
            captions[0];

          let captionUrl: string = track.baseUrl;
          captionUrl = captionUrl.replace('&fmt=srv3', '');

          if (!captionUrl.includes('&exp=xpe')) {
            const captionRes = await fetch(captionUrl);
            if (captionRes.ok) {
              const xml = await captionRes.text();
              const transcript = parseTranscriptXml(xml);
              if (transcript) {
                return {
                  transcript,
                  title: playerData?.videoDetails?.title || '',
                  author: playerData?.videoDetails?.author || '',
                };
              }
            }
          }
        }
      }
    }
  } catch (e: any) {
    // CORS or network error — fall through to server-side
    console.log('[youtube] Client-side innertube failed:', e?.message || 'unknown error');
  }

  // Strategy 2: Server-side route (works from dev, may work from some Vercel regions)
  try {
    const res = await fetch('/api/youtube-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.transcript) {
        console.log('[youtube] Edge route succeeded');
        return data;
      }
    } else {
      const errBody = await res.text().catch(() => '');
      console.warn('[youtube] Edge route failed:', res.status, errBody.slice(0, 200));
    }
  } catch {
    console.log('[youtube] Edge route network error, trying Python backend...');
  }

  // Strategy 3: Python backend on Digital Ocean (different IP, uses youtube-transcript-api)
  try {
    const backendUrl = process.env.NEXT_PUBLIC_ARENA_BACKEND_URL || 'https://arena-analysis-api-2puat.ondigitalocean.app';
    const res = await fetch(`${backendUrl}/api/youtube-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.transcript) {
        console.log('[youtube] Python backend succeeded');
        return data;
      }
    }
  } catch {
    console.log('[youtube] Python backend also failed');
  }

  // Strategy 4: oEmbed metadata fallback (always works from any IP)
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (oembedRes.ok) {
      const meta = await oembedRes.json();
      return {
        transcript: `[Transcrição indisponível — legendas não puderam ser extraídas do servidor]\n\nURL: ${url}`,
        title: meta.title || '',
        author: meta.author_name || '',
      };
    }
  } catch {
    // Even oEmbed failed
  }

  return null;
}

function parseTranscriptXml(xml: string): string | null {
  if (!xml || xml.length === 0) return null;

  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  const texts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const decoded = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '');
    if (decoded.trim()) texts.push(decoded.trim());
  }

  if (texts.length === 0) return null;

  let transcript = texts.join(' ');
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '... [transcrição truncada]';
  }
  return transcript;
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
 * Flow:
 *   1. Browser gets signed upload URL (lightweight Vercel route, ~50ms)
 *   2. Browser uploads video directly to Supabase Storage (no Vercel body limit)
 *   3. Browser gets signed download URL (lightweight Vercel route, ~50ms)
 *   4. Browser calls DO directly with the URL → DO downloads, FFmpeg, Whisper
 *   5. Cleanup: delete temp file from Supabase
 */
export async function transcribeVideoBackend(file: File): Promise<string | null> {
  const TIMEOUT_MS = 90_000;
  const BACKEND = process.env.NEXT_PUBLIC_ARENA_BACKEND_URL || 'https://arena-analysis-api-2puat.ondigitalocean.app';

  let storagePath = '';

  try {
    // 1. Get signed upload URL via lightweight API route (uses service role key)
    console.log(`[transcribeVideo] Getting upload URL...`);
    const urlRes = await fetch('/api/transcribe-video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name }),
    });

    if (!urlRes.ok) {
      console.error('[transcribeVideo] Failed to get upload URL:', urlRes.status);
      return null;
    }

    const { signedUrl: uploadUrl, path } = await urlRes.json();
    storagePath = path;

    // 2. Upload directly to Supabase Storage (browser → Supabase, no Vercel body limit)
    console.log(`[transcribeVideo] Uploading ${(file.size / (1024 * 1024)).toFixed(1)}MB to Supabase...`);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/webm' },
      body: file,
    });

    if (!uploadRes.ok) {
      console.error('[transcribeVideo] Upload failed:', uploadRes.status);
      return null;
    }
    console.log('[transcribeVideo] Upload OK');

    // 3. Get signed download URL for DO (lightweight Vercel route)
    const dlRes = await fetch('/api/transcribe-video/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: storagePath }),
    });

    if (!dlRes.ok) {
      console.error('[transcribeVideo] Failed to get download URL:', dlRes.status);
      return null;
    }

    const { signedUrl: downloadUrl } = await dlRes.json();

    // 4. Call DO directly with the Supabase URL (no Vercel proxy for heavy work)
    console.log('[transcribeVideo] Sending to DO for transcription...');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${BACKEND}/api/transcribe-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: downloadUrl,
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
    if (storagePath) {
      fetch('/api/transcribe-video/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: storagePath, action: 'delete' }),
      }).catch(() => {});
    }
  }
}

export async function processAttachmentsForUpload(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
  const results: ProcessedAttachment[] = [];

  for (const att of attachments) {
    if (att.type === 'url' && att.url) {
      // YouTube URLs: fetch transcript (client-side → server → oEmbed fallback)
      if (isYouTubeUrl(att.url)) {
        const yt = await fetchYouTubeTranscript(att.url);
        if (yt) {
          const header = [yt.title, yt.author].filter(Boolean).join(' — ');
          const fullTranscript = header
            ? `[YouTube: ${header}]\n\n${yt.transcript}`
            : yt.transcript;
          results.push({ type: 'video', data: fullTranscript, name: yt.title || att.name });
          continue;
        }
      }
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
