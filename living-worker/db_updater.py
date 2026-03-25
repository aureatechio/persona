"""
DB Updater — aplica deltas de sentimento no banco via Supabase RPCs.
"""
from __future__ import annotations

from config import settings
from impact_analyzer import ImpactResult


class DBUpdater:
    def __init__(self):
        self._supabase = None

    def _get_supabase(self):
        if self._supabase is None:
            from supabase import create_client
            self._supabase = create_client(settings.supabase_url, settings.supabase_key)
        return self._supabase

    def apply_sentiment_delta(
        self,
        cluster_prefix: str,
        candidate_id: str,
        delta: float,
    ) -> int:
        """Aplica delta de sentimento para um cluster × candidato."""
        sb = self._get_supabase()
        result = sb.rpc("apply_sentiment_delta", {
            "p_cluster_prefix": cluster_prefix,
            "p_candidate_id": candidate_id,
            "p_delta": round(delta, 4),
        }).execute()
        return result.data or 0

    def log_sentiment_update(
        self,
        news_event_id: str | None,
        cycle_id: str,
        cluster_id: str,
        candidate_id: str,
        delta: float,
        personas_affected: int,
        reasoning: str,
    ):
        """Log de auditoria para cada delta aplicado."""
        sb = self._get_supabase()
        sb.table("sentiment_updates").insert({
            "news_event_id": news_event_id,
            "cycle_id": cycle_id,
            "cluster_id": cluster_id,
            "candidate_id": candidate_id,
            "delta_applied": round(delta, 4),
            "personas_affected": personas_affected,
            "reasoning": reasoning,
        }).execute()

    def save_news_event(
        self,
        candidate_id: str,
        headline: str,
        summary: str,
        source_url: str,
        impact: ImpactResult | None,
        cycle_id: str,
        status: str = "analyzed",
    ) -> str:
        """Salva notícia processada no banco."""
        sb = self._get_supabase()

        data = {
            "candidate_id": candidate_id,
            "headline": headline,
            "source_url": source_url,
            "summary": summary,
            "cycle_id": cycle_id,
            "status": status,
        }

        if impact:
            data["impact_magnitude"] = round(impact.magnitude, 3)
            data["impact_direction"] = impact.candidate_effect
            data["affected_clusters"] = [s.cluster_macro for s in impact.affected_segments]
            data["impact_analysis"] = {
                "news_type": impact.news_type,
                "magnitude": impact.magnitude,
                "candidate_effect": impact.candidate_effect,
                "segments": [
                    {
                        "cluster_macro": s.cluster_macro,
                        "sensitivity": s.sensitivity,
                        "direction": s.direction,
                        "reason": s.reason,
                        "sensitivity_fields": s.sensitivity_fields,
                    }
                    for s in impact.affected_segments
                ],
                "cross_effects": [
                    {
                        "candidate_id": c.candidate_id,
                        "direction": c.direction,
                        "magnitude": c.magnitude,
                    }
                    for c in impact.cross_candidate_effects
                ],
            }

        result = sb.table("news_events").insert(data).execute()
        return result.data[0]["id"] if result.data else ""

    def create_cycle(self) -> str:
        """Cria registro de ciclo de atualização."""
        sb = self._get_supabase()
        result = sb.table("update_cycles").insert({
            "status": "running",
        }).execute()
        return result.data[0]["id"]

    def complete_cycle(
        self,
        cycle_id: str,
        news_count: int,
        news_applied: int,
        news_skipped: int,
        updates_applied: int,
        snapshot_id: str | None,
        summary: dict | None = None,
    ):
        """Finaliza ciclo de atualização."""
        sb = self._get_supabase()
        sb.table("update_cycles").update({
            "status": "completed",
            "completed_at": "now()",
            "news_count": news_count,
            "news_applied": news_applied,
            "news_skipped": news_skipped,
            "updates_applied": updates_applied,
            "snapshot_id": snapshot_id,
            "summary": summary or {},
        }).eq("id", cycle_id).execute()

    def fail_cycle(self, cycle_id: str, error: str):
        """Marca ciclo como falho."""
        sb = self._get_supabase()
        sb.table("update_cycles").update({
            "status": "failed",
            "completed_at": "now()",
            "error_message": error,
        }).eq("id", cycle_id).execute()

    def compute_polling(self) -> dict:
        """Recomputa percentuais de polling a partir dos sentimentos."""
        sb = self._get_supabase()
        result = sb.rpc("compute_polling").execute()
        return result.data or {}

    def get_current_polling(self) -> dict[str, float]:
        """Retorna polling atual por candidato."""
        sb = self._get_supabase()
        result = sb.table("candidates") \
            .select("id, polling_percent") \
            .eq("is_active", True) \
            .execute()
        return {r["id"]: float(r["polling_percent"] or 0) for r in result.data}

    def get_candidates(self) -> list[dict]:
        """Retorna lista de candidatos ativos."""
        sb = self._get_supabase()
        result = sb.table("candidates").select("*").eq("is_active", True).execute()
        return result.data

    def save_polling_history(self, cycle_id: str | None = None):
        """Salva snapshot do polling atual no histórico (para gráfico de tendência)."""
        sb = self._get_supabase()
        candidates = sb.table("candidates").select("id, polling_percent").eq("is_active", True).execute()

        rows = [
            {
                "candidate_id": c["id"],
                "polling_percent": float(c["polling_percent"] or 0),
                "scenario": "2turno_vs_lula",
                "cycle_id": cycle_id,
            }
            for c in candidates.data
        ]

        if rows:
            sb.table("polling_history").insert(rows).execute()
