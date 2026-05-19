import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = 'http://localhost:3010';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${WORKER_URL}/${path.join('/')}${request.nextUrl.search}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Worker not reachable', details: String(err) }, { status: 502 });
  }
}
