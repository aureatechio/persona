import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * V2 Process: Creates a v2_video_selfies record and returns a signed upload URL.
 * The browser uploads the video directly to Supabase Storage.
 *
 * Operates ONLY on v2_base_models and v2_video_selfies.
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
      return NextResponse.json({ error: 'slug é obrigatório' }, { status: 400 });
    }

    // Resolve slug -> base_model_id from v2_base_models
    const { data: model, error: modelError } = await supabaseAdmin
      .from('v2_base_models')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (modelError) {
      console.error('[v2/process] base model lookup error:', modelError);
      return NextResponse.json({ error: 'Falha ao consultar modelo' }, { status: 500 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Modelo não encontrado ou inativo' }, { status: 404 });
    }

    // Create record in v2_video_selfies
    const { data: record, error: dbError } = await supabaseAdmin
      .from('v2_video_selfies')
      .insert({
        name,
        phone: phone.replace(/\D/g, ''),
        status: 'uploading',
        base_model_id: model.id,
      })
      .select()
      .single();

    if (dbError || !record) {
      console.error('[v2/process] DB error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar registro' }, { status: 500 });
    }

    // Generate signed upload URL
    const videoPath = `v2/selfies/${record.id}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(videoPath);

    if (uploadError || !uploadData) {
      console.error('[v2/process] Signed URL error:', uploadError);
      await supabaseAdmin
        .from('v2_video_selfies')
        .update({ status: 'failed', error_message: 'Failed to create upload URL' })
        .eq('id', record.id);
      return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
    }

    // Set video path on the record
    await supabaseAdmin
      .from('v2_video_selfies')
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
    console.error('[v2/process] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
