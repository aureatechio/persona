import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SYNC_API_KEY = process.env.SYNC_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const voice_model_id = searchParams.get('voice_model_id');
    const phrase_hash = searchParams.get('phrase_hash');

    if (!username || !voice_model_id || !phrase_hash) {
      return NextResponse.json(
        { error: 'username, voice_model_id, phrase_hash são obrigatórios' },
        { status: 400 },
      );
    }

    // 1. Lookup record
    const { data: record } = await supabaseAdmin
      .from('lipsync_videos')
      .select('*')
      .eq('voice_model_id', voice_model_id)
      .eq('username', username)
      .eq('phrase_hash', phrase_hash)
      .single();

    if (!record) {
      return NextResponse.json({ status: 'not_found', video_url: null });
    }

    // 2. If already completed or failed, return immediately
    if (record.status === 'completed' || record.status === 'failed') {
      return NextResponse.json({
        status: record.status,
        video_url: record.video_url || null,
        error_message: record.error_message || null,
      });
    }

    // 3. If generating_lipsync, poll Sync Labs
    if (record.status === 'generating_lipsync' && record.sync_job_id && SYNC_API_KEY) {
      const syncRes = await fetch(`https://api.sync.so/v2/generate/${record.sync_job_id}`, {
        headers: { 'x-api-key': SYNC_API_KEY },
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();

        if (syncData.status === 'COMPLETED' && syncData.outputUrl) {
          await supabaseAdmin
            .from('lipsync_videos')
            .update({
              status: 'completed',
              video_url: syncData.outputUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          return NextResponse.json({
            status: 'completed',
            video_url: syncData.outputUrl,
          });
        }

        if (syncData.status === 'FAILED' || syncData.status === 'REJECTED') {
          const errorMsg = syncData.error || 'Sync Labs generation failed';
          await supabaseAdmin
            .from('lipsync_videos')
            .update({
              status: 'failed',
              error_message: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          return NextResponse.json({
            status: 'failed',
            video_url: null,
            error_message: errorMsg,
          });
        }
      }
    }

    // 4. Still processing
    return NextResponse.json({
      status: record.status,
      video_url: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('voice-model/poll-status error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
