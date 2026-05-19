import { NextResponse } from 'next/server';

const WORKER_URL = 'http://localhost:3010';

export async function GET() {
  try {
    const resp = await fetch(`${WORKER_URL}/status`);
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Worker not reachable', ready: false, progress: { status: 'offline', loaded: 0, total: 0, voted: 0 }, totalPersonas: 0, totalVoted: 0 }, { status: 502 });
  }
}
