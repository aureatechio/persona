const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const upstream = await fetch(`${BACKEND}/api/arena/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await upstream.json();
    return Response.json(data);
  } catch {
    return Response.json(
      { status: 'offline', error: 'Python backend unreachable' },
      { status: 502 },
    );
  }
}
