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

export async function processAttachmentsForUpload(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
  const results: ProcessedAttachment[] = [];

  for (const att of attachments) {
    if (att.type === 'url' && att.url) {
      results.push({ type: 'url', data: att.url, name: att.name });
    } else if (att.type === 'image' && att.file) {
      const base64 = await compressImage(att.file);
      results.push({ type: 'image', data: base64, name: att.name });
    } else if (att.type === 'video' && att.file) {
      const base64 = await fileToBase64(att.file);
      results.push({ type: 'video', data: base64, name: att.name });
    }
  }

  return results;
}
