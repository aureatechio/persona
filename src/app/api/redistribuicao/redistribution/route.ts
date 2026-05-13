import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = 'http://localhost:3010';

export async function GET(request: NextRequest) {
  const candidateId = request.nextUrl.searchParams.get('id');
  if (!candidateId) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${WORKER_URL}/redistribution/${candidateId}`);
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Worker not reachable' }, { status: 502 });
  }
}
