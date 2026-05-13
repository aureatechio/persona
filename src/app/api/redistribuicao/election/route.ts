import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = 'http://localhost:3010';

export async function GET(request: NextRequest) {
  const exclude = request.nextUrl.searchParams.get('exclude') || '';
  const url = exclude ? `${WORKER_URL}/election?exclude=${exclude}` : `${WORKER_URL}/election`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Worker not reachable' }, { status: 502 });
  }
}
