const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

// No duration limit — Python processes 20k personas via GPT, can take 10+ min
export const maxDuration = 800;

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const upstream = await fetch(`${BACKEND}/api/arena/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // Propagate client abort to Python backend
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ error: 'Backend unavailable', fallback: true }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    // Don't log abort errors — they're expected when user clicks "Novo Chat"
    if (err?.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    console.warn('[Arena API] Python backend unreachable:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'Python backend offline', fallback: true }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
