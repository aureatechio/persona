const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export const maxDuration = 800;

export async function POST(request: Request) {
  const body = await request.json();

  // Always enable verbose mode for the monitor
  const payload = { ...body, verbose: true };

  const upstream = await fetch(`${BACKEND}/api/arena/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText, { status: upstream.status });
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
}
