import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';
const TIMEOUT_MS = 20_000;

/**
 * Proxy to Python backend for YouTube transcript extraction.
 * YouTube requires PoToken for captions — only the Python youtube-transcript-api
 * handles this correctly. Vercel/Node packages return empty transcripts.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${BACKEND}/api/youtube-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout ao buscar transcricao' }, { status: 504 });
    }
    console.error('[youtube-transcript] Proxy error:', err?.message);
    return NextResponse.json({ error: 'Falha ao buscar transcricao' }, { status: 502 });
  }
}
