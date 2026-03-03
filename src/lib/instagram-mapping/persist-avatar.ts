import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Downloads an image from an external URL and uploads it to Supabase Storage.
 * Returns the permanent public URL, or null on failure.
 */
export async function persistAvatarToStorage(
  externalUrl: string,
  followerId: string,
): Promise<string | null> {
  try {
    const response = await fetch(externalUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    // Skip if too small (likely a placeholder)
    if (buffer.byteLength < 500) return null;

    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : 'jpg';

    const filePath = `instagram/${followerId}.${ext}`;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`Avatar upload failed for ${followerId}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error(`Avatar persist failed for ${followerId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
