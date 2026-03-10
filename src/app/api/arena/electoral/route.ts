const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.text();

  const upstream = await fetch(`${BACKEND}/api/arena/electoral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
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
