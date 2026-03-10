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
 * Extract audio from a video file in the browser.
 * Uses AudioContext.decodeAudioData to decode the video's audio track,
 * then encodes to WAV mono 16kHz (~2MB for 2 minutes).
 * This avoids uploading the full video (which can be 200-400MB from phone cameras).
 */
export async function extractAudioFromVideo(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Downsample to 16kHz mono for Whisper (much smaller file)
    const targetSampleRate = 16000;
    const channelData = audioBuffer.getChannelData(0); // mono - first channel
    const duration = audioBuffer.duration;
    const sourceSampleRate = audioBuffer.sampleRate;

    // Calculate output size
    const outputLength = Math.ceil(duration * targetSampleRate);
    const outputData = new Float32Array(outputLength);

    // Resample
    const ratio = sourceSampleRate / targetSampleRate;
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio;
      const srcIdxFloor = Math.floor(srcIdx);
      const srcIdxCeil = Math.min(srcIdxFloor + 1, channelData.length - 1);
      const frac = srcIdx - srcIdxFloor;
      outputData[i] = channelData[srcIdxFloor] * (1 - frac) + channelData[srcIdxCeil] * frac;
    }

    // Encode as WAV
    const wavBuffer = encodeWAV(outputData, targetSampleRate);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

    // Convert to base64 data URI
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(wavBlob);
    });

    await audioContext.close();
    return base64;
  } catch (err) {
    await audioContext.close();
    throw err;
  }
}

/** Encode Float32Array PCM samples to WAV format */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples - clamp to 16-bit range
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
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
      try {
        // Extract just the audio track (16kHz mono WAV, ~2MB for 2min)
        // instead of sending the full video (200-400MB from phone cameras)
        const audioBase64 = await extractAudioFromVideo(att.file);
        results.push({ type: 'video', data: audioBase64, name: att.name });
      } catch (err) {
        console.warn('[file-utils] Audio extraction failed, sending raw file:', err);
        // Fallback: try to send the file directly (may fail if too large)
        const base64 = await fileToBase64(att.file);
        results.push({ type: 'video', data: base64, name: att.name });
      }
    }
  }

  return results;
}
