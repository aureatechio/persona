import { NextResponse } from "next/server";

const WORKER_URL = process.env.LIVING_WORKER_URL || "http://localhost:3020";

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const res = await fetch(`${WORKER_URL}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Worker responded with ${res.status}`, detail: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message, detail: "Could not reach living worker" },
      { status: 502 }
    );
  }
}
