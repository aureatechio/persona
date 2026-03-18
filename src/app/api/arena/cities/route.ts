const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  if (!state) return Response.json({ error: 'state required' }, { status: 400 });

  try {
    const res = await fetch(`${BACKEND}/api/arena/cities?state=${encodeURIComponent(state)}`);
    if (!res.ok) return Response.json({ error: 'Backend error' }, { status: 502 });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: 'Backend offline' }, { status: 502 });
  }
}
