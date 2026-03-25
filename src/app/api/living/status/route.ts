import { NextResponse } from "next/server";

const WORKER_URL = process.env.LIVING_WORKER_URL || "http://localhost:3020";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/status`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Worker responded with ${res.status}` },
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
