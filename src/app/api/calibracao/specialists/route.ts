const SPECIALIST_WORKER_URL = process.env.SPECIALIST_WORKER_URL || 'http://localhost:3011';

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(`${SPECIALIST_WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[Calibracao Specialists] Worker returned:', res.status);
      return Response.json({ error: 'Specialist worker error', status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return Response.json({ error: 'Specialist worker timeout' }, { status: 504 });
    }
    console.warn('[Calibracao Specialists] Worker unreachable:', err?.message || err);
    return Response.json({ error: 'Specialist worker unavailable' }, { status: 502 });
  }
}
