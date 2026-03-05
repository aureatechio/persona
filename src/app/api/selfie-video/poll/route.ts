import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pollLipsyncJob } from '@/lib/lipsync';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { data: record } = await supabaseAdmin
      .from('video_selfies')
      .select('*')
      .eq('id', id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    // If completed or failed, return immediately
    if (record.status === 'completed' || record.status === 'failed') {
      return NextResponse.json({
        status: record.status,
        final_video_path: record.final_video_path || null,
        error_message: record.error_message || null,
      });
    }

    // If generating_lipsync, poll via lib/lipsync (Kling or Sync Labs)
    if (record.status === 'generating_lipsync' && record.lipsync_job_id) {
      const result = await pollLipsyncJob(record.lipsync_job_id);

      if (result.status === 'completed' && result.outputUrl) {
        await supabaseAdmin
          .from('video_selfies')
          .update({
            lipsync_video_url: result.outputUrl,
            status: 'composing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        // Trigger compose step
        const baseUrl = request.nextUrl.origin;
        fetch(`${baseUrl}/api/selfie-video/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selfie_id: record.id }),
        }).catch(err => console.error('Compose trigger error:', err));

        return NextResponse.json({ status: 'composing' });
      }

      if (result.status === 'failed') {
        const errorMsg = result.error || 'Lip-sync generation failed';
        await supabaseAdmin
          .from('video_selfies')
          .update({
            status: 'failed',
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        return NextResponse.json({ status: 'failed', error_message: errorMsg });
      }
    }

    return NextResponse.json({ status: record.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/poll error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
