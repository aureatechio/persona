import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * V3 Process: Creates a v3_video_selfies record and returns a signed upload URL.
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

    const { data: model, error: modelError } = await supabaseAdmin
      .from('v3_base_models')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (modelError || !model) {
      return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 });
    }

    const { data: record, error: dbError } = await supabaseAdmin
      .from('v3_video_selfies')
      .insert({
        name,
        phone: phone.replace(/\D/g, ''),
        status: 'uploading',
        base_model_id: model.id,
      })
      .select()
      .single();

    if (dbError || !record) {
      return NextResponse.json({ error: 'Falha ao criar registro' }, { status: 500 });
    }

    const videoPath = `v3/selfies/${record.id}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(videoPath);

    if (uploadError || !uploadData) {
      await supabaseAdmin
        .from('v3_video_selfies')
        .update({ status: 'failed', error_message: 'Failed to create upload URL' })
        .eq('id', record.id);
      return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
    }

    await supabaseAdmin
      .from('v3_video_selfies')
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
