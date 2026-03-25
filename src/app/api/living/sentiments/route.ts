import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. Distribuição de sentimento por candidato (agregado)
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, name, party, leaning, polling_percent, sentiment_trend, is_active")
      .eq("is_active", true)
      .order("polling_percent", { ascending: false });

    // 2. Distribuição por cluster macro × candidato
    // Query: avg sentiment, count positive/negative/neutral per cluster_prefix per candidate
    const { data: distribution } = await supabase.rpc("get_sentiment_distribution");

    // 3. Última atualização
    const { data: lastCycle } = await supabase
      .from("update_cycles")
      .select("id, started_at, completed_at, status, news_applied, summary")
      .order("started_at", { ascending: false })
      .limit(1);

    // 4. Total de personas com sentimento
    const { count } = await supabase
      .from("persona_sentiments")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      candidates: candidates || [],
      distribution: distribution || [],
      lastCycle: lastCycle?.[0] || null,
      totalPersonas: count || 0,
    });
  } catch (error) {
    console.error("Sentiments API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentiments" },
      { status: 500 }
    );
  }
}
