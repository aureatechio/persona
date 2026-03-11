/**
 * Generate a signed upload URL for video transcription.
 * Browser uploads directly to Supabase Storage (bypasses Vercel body limits).
 * Returns { signedUrl, path } for the browser to PUT the file.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    const ext = filename?.split('.').pop() || 'webm';
    const storagePath = `temp-transcriptions/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[UploadURL] Error:', error);
      return Response.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    return Response.json({
      signedUrl: data.signedUrl,
      path: storagePath,
    });
  } catch (err: any) {
    console.error('[UploadURL] Error:', err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
