import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calcula cenários head-to-head: cada candidato vs Lula
 * Para cada persona: compara sentiment_candidato vs sentiment_lula
 * Quem tiver maior sentimento "vota" nele. Se ambos < 0.02 ou diff < 0.015 → branco/nulo.
 */
export async function GET() {
  try {
    // Buscar candidatos
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, name, party, photo_url, leaning, polling_percent, sentiment_trend")
      .eq("is_active", true);

    if (!candidates?.length) {
      return NextResponse.json({ matchups: [], candidates: [] });
    }

    const opponents = candidates.filter((c) => c.id !== "lula");
    const lula = candidates.find((c) => c.id === "lula");

    if (!lula) {
      return NextResponse.json({ matchups: [], candidates });
    }

    // Para cada oponente, calcular head-to-head vs Lula via SQL
    const matchups = [];

    for (const opponent of opponents) {
      const { data: result } = await supabase.rpc("compute_headtohead", {
        p_candidate_a: opponent.id,
        p_candidate_b: "lula",
      });

      if (result) {
        matchups.push({
          candidateId: opponent.id,
          candidateName: opponent.name,
          candidateParty: opponent.party,
          candidatePhoto: opponent.photo_url,
          votesCandidate: result.votes_a,
          votesLula: result.votes_b,
          abstentions: result.abstentions,
          totalPersonas: result.total,
          pctCandidate: result.pct_a,
          pctLula: result.pct_b,
          pctAbstention: result.pct_abstention,
        });
      }
    }

    // Ordenar por % do candidato (quem mais ameaça Lula primeiro)
    matchups.sort((a, b) => b.pctCandidate - a.pctCandidate);

    return NextResponse.json({
      matchups,
      lula: {
        id: lula.id,
        name: lula.name,
        party: lula.party,
        photo_url: lula.photo_url,
      },
      candidates,
      totalPersonas: matchups[0]?.totalPersonas || 0,
    });
  } catch (error) {
    console.error("Matchups API error:", error);
    return NextResponse.json({ error: "Failed to compute matchups" }, { status: 500 });
  }
}
