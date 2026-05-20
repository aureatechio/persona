import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Apaga do ElevenLabs vozes "custom" (cloned/generated) que não estão
// referenciadas em voice_models.elevenlabs_voice_id. Útil quando o limite
// do plano (ex: 10/10) bloqueia novos clones.
//
// GET  → preview: lista o que SERIA apagado
// POST → executa a limpeza

async function listElevenLabsVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.voices) ? data.voices : [];
}

async function listReferencedVoiceIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('voice_models')
    .select('elevenlabs_voice_id')
    .not('elevenlabs_voice_id', 'is', null);
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return new Set((data || []).map((r) => r.elevenlabs_voice_id).filter(Boolean) as string[]);
}

async function buildPlan() {
  const [voices, referenced] = await Promise.all([
    listElevenLabsVoices(),
    listReferencedVoiceIds(),
  ]);

  // Só consideramos órfãs as vozes "custom" (criadas pela conta).
  // Vozes do catálogo público (category=premade/professional) não contam
  // no limite e nem deveriam ser apagadas.
  const orphans = voices.filter((v) => {
    const isCustom = v.category === 'cloned' || v.category === 'generated';
    return isCustom && !referenced.has(v.voice_id);
  });

  return {
    totalVoices: voices.length,
    referencedCount: referenced.size,
    orphans,
  };
}

export async function GET() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }
    const plan = await buildPlan();
    return NextResponse.json({
      preview: true,
      totalVoices: plan.totalVoices,
      referencedCount: plan.referencedCount,
      orphans: plan.orphans.map((v) => ({ voice_id: v.voice_id, name: v.name, category: v.category })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }

    const plan = await buildPlan();

    const deleted: Array<{ voice_id: string; name: string }> = [];
    const failed: Array<{ voice_id: string; name: string; error: string }> = [];

    for (const v of plan.orphans) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        });
        if (!res.ok) {
          const text = await res.text();
          failed.push({ voice_id: v.voice_id, name: v.name, error: `${res.status}: ${text.slice(0, 120)}` });
          continue;
        }
        deleted.push({ voice_id: v.voice_id, name: v.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        failed.push({ voice_id: v.voice_id, name: v.name, error: msg });
      }
    }

    return NextResponse.json({
      totalVoices: plan.totalVoices,
      referencedCount: plan.referencedCount,
      orphanCount: plan.orphans.length,
      deleted,
      failed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
