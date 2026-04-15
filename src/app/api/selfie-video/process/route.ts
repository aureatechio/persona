import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Creates a DB record and returns a signed upload URL.
 * The browser uploads the video directly to Supabase Storage,
 * bypassing Vercel's 4.5MB body limit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name as string) || '';
    const phone = (body.phone as string) || '';
    const ext = (body.ext as string) || 'webm';
    const slug = (body.slug as string) || '';

    if (!name || !phone) {
      return NextResponse.json({ error: 'name e phone são obrigatórios' }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'slug do político é obrigatório' }, { status: 400 });
    }

    // Resolve slug → base_model_id. Requires the model to be is_active=true.
    const { data: model, error: modelError } = await supabaseAdmin
      .from('video_base_models')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (modelError) {
      console.error('Base model lookup error:', modelError);
      return NextResponse.json({ error: 'Falha ao consultar político' }, { status: 500 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Político não encontrado ou indisponível' }, { status: 404 });
    }

    // 1. Create DB record
    const { data: record, error: dbError } = await supabaseAdmin
      .from('video_selfies')
      .insert({
        name,
        phone: phone.replace(/\D/g, ''),
        status: 'uploading',
        base_model_id: model.id,
      })
      .select()
      .single();

    if (dbError || !record) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar registro' }, { status: 500 });
    }

    // 2. Generate signed upload URL for browser to upload directly
    const videoPath = `selfies/${record.id}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(videoPath);

    if (uploadError || !uploadData) {
      console.error('Signed URL error:', uploadError);
      await supabaseAdmin.from('video_selfies').update({ status: 'failed', error_message: 'Failed to create upload URL' }).eq('id', record.id);
      return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
    }

    // 3. Pre-set the video path on the record
    await supabaseAdmin
      .from('video_selfies')
      .update({ selfie_video_path: videoPath, updated_at: new Date().toISOString() })
      .eq('id', record.id);

    return NextResponse.json({
      id: record.id,
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      path: videoPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/process error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
