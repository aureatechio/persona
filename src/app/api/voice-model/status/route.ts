import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// GET - Fetch current active voice model
export async function GET() {
  try {
    const { data: model } = await supabaseAdmin
      .from('voice_models')
      .select('*')
      .in('status', ['ready', 'approved', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ model: model || null });
  } catch {
    return NextResponse.json({ model: null });
  }
}

// PATCH - Update model status (approve/unapprove)
export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id || !['ready', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'id e status (ready|approved) são obrigatórios' }, { status: 400 });
    }

    const { data: model, error } = await supabaseAdmin
      .from('voice_models')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Falha ao atualizar modelo' }, { status: 500 });
    }

    return NextResponse.json({ model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Remove voice model + cleanup
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // 1. Fetch model
    const { data: model } = await supabaseAdmin
      .from('voice_models')
      .select('*')
      .eq('id', id)
      .single();

    if (!model) {
      return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 });
    }

    // 2. Delete voice from ElevenLabs
    if (model.elevenlabs_voice_id && ELEVENLABS_API_KEY) {
      await fetch(`https://api.elevenlabs.io/v1/voices/${model.elevenlabs_voice_id}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      }).catch(() => {});
    }

    // 3. Delete lipsync videos from storage
    const { data: lipsyncVideos } = await supabaseAdmin
      .from('lipsync_videos')
      .select('tts_audio_path, video_storage_path')
      .eq('voice_model_id', id);

    if (lipsyncVideos?.length) {
      const storagePaths = lipsyncVideos
        .flatMap(v => [v.tts_audio_path, v.video_storage_path])
        .filter(Boolean) as string[];

      if (storagePaths.length) {
        await supabaseAdmin.storage.from('voice-models').remove(storagePaths);
      }
    }

    // 4. Delete lipsync_videos records
    await supabaseAdmin
      .from('lipsync_videos')
      .delete()
      .eq('voice_model_id', id);

    // 5. Delete recording from storage
    if (model.video_storage_path) {
      await supabaseAdmin.storage.from('voice-models').remove([model.video_storage_path]);
    }

    // 6. Delete model record
    await supabaseAdmin
      .from('voice_models')
      .delete()
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
