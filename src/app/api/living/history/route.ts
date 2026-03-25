import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Histórico de polling por candidato (últimos 30 dias)
    const { data } = await supabase
      .from("polling_history")
      .select("candidate_id, polling_percent, created_at, scenario")
      .order("created_at", { ascending: true })
      .limit(500);

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
