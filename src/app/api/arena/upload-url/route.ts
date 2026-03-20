/**
 * Generate a signed upload URL for Arena media analysis.
 * Mobile uploads directly to Supabase Storage (bypasses payload limits).
 * Returns { signedUrl, publicUrl, path } for the client to PUT the file.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { filename, mimeType } = await request.json();
    const ext = filename?.split('.').pop() || 'jpg';
    const storagePath = `arena-uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[Arena Upload] Error:', error);
      return Response.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    // Generate a signed download URL (1h) for the API to read the file
    const { data: downloadData } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(storagePath, 3600);

    return Response.json({
      signedUrl: data.signedUrl,
      downloadUrl: downloadData?.signedUrl || '',
      path: storagePath,
      token: data.token,
    });
  } catch (err: any) {
    console.error('[Arena Upload] Error:', err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
