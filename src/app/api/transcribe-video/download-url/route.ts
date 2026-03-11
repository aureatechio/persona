/**
 * Generate a signed download URL for a video in Supabase Storage.
 * DO backend uses this URL to download the video for transcription.
 * Also handles cleanup (delete) after transcription.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export async function POST(request: Request) {
  try {
    const { path, action } = await request.json();

    if (!path || !path.startsWith('temp-transcriptions/')) {
      return Response.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Delete action — cleanup after transcription
    if (action === 'delete') {
      await supabaseAdmin.storage.from('voice-models').remove([path]);
      return Response.json({ ok: true });
    }

    // Default: generate signed download URL (5 min expiry)
    const { data, error } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      console.error('[DownloadURL] Error:', error);
      return Response.json({ error: 'Failed to create download URL' }, { status: 500 });
    }

    return Response.json({ signedUrl: data.signedUrl });
  } catch (err: any) {
    console.error('[DownloadURL] Error:', err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
