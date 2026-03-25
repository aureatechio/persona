"""
Safety Guard — limites de drift, snapshots, dedup.
Previne mudanças descontroladas nos sentimentos.
"""
from __future__ import annotations

from datetime import datetime, timezone

from config import settings


class SafetyGuard:
    def __init__(self):
        self._supabase = None

    def _get_supabase(self):
        if self._supabase is None:
            from supabase import create_client
            self._supabase = create_client(settings.supabase_url, settings.supabase_key)
        return self._supabase

    def get_daily_drift(self, candidate_id: str) -> float:
        """Soma absoluta de todos os deltas aplicados hoje para este candidato."""
        sb = self._get_supabase()
        today = datetime.now(timezone.utc).date().isoformat()

        result = sb.table("sentiment_updates") \
            .select("delta_applied") \
            .eq("candidate_id", candidate_id) \
            .gte("created_at", today) \
            .execute()

        return sum(abs(float(r["delta_applied"] or 0)) for r in result.data)

    def check_budget_remaining(self, candidate_id: str) -> float:
        """Quanto do budget diário resta para este candidato."""
        used = self.get_daily_drift(candidate_id)
        return max(0, settings.max_daily_drift - used)

    def should_skip_news(self, candidate_id: str, magnitude: float) -> bool:
        """Verifica se devemos pular esta notícia por falta de budget."""
        if magnitude < settings.min_magnitude:
            return True

        remaining = self.check_budget_remaining(candidate_id)
        estimated_impact = magnitude * settings.max_single_delta * 0.5
        return remaining < estimated_impact

    def create_snapshot(self, label: str) -> str | None:
        """Cria snapshot de sentimentos para rollback."""
        sb = self._get_supabase()
        try:
            result = sb.rpc("create_sentiment_snapshot", {"p_label": label}).execute()
            snapshot_id = result.data
            print(f"[Safety] Snapshot criado: {snapshot_id} ({label})")
            return snapshot_id
        except Exception as e:
            print(f"[Safety] Erro criando snapshot: {e}")
            return None

    def rollback_cycle(self, cycle_id: str) -> bool:
        """Restaura sentimentos do snapshot de um ciclo."""
        sb = self._get_supabase()
        try:
            cycle = sb.table("update_cycles") \
                .select("snapshot_id") \
                .eq("id", cycle_id) \
                .single() \
                .execute()

            snapshot_id = cycle.data.get("snapshot_id")
            if not snapshot_id:
                print(f"[Safety] Ciclo {cycle_id} não tem snapshot")
                return False

            result = sb.rpc("restore_sentiment_snapshot", {"p_snapshot_id": snapshot_id}).execute()
            affected = result.data

            # Marcar ciclo como rolled back
            sb.table("update_cycles") \
                .update({"status": "rolled_back"}) \
                .eq("id", cycle_id) \
                .execute()

            print(f"[Safety] Rollback completo: {affected} sentimentos restaurados")
            return True

        except Exception as e:
            print(f"[Safety] Erro no rollback: {e}")
            return False
