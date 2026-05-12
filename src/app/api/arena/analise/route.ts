/**
 * Proxy para o Python backend (Digital Ocean).
 * A Duda agora roda no Python como step do pipeline SSE.
 * Este endpoint existe para backward-compatibility (calibracao, apresentacao).
 */
import { NextRequest } from 'next/server';

export const maxDuration = 120;

const PYTHON_BACKEND = process.env.ARENA_ANALYSIS_URL || 'https://arena-analysis-api-2puat.ondigitalocean.app';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${PYTHON_BACKEND}/api/duda/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[Analise Proxy] Python error:', res.status, text.slice(0, 200));
      return Response.json({ error: 'Falha na analise' }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err: any) {
    console.error('[Analise Proxy] Error:', err?.message);
    return Response.json({ error: 'Falha na analise' }, { status: 500 });
  }
}
