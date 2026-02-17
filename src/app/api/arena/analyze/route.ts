const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(`${BACKEND}/api/arena/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
    console.warn('[Arena API] Python backend unreachable:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'Python backend offline', fallback: true }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
