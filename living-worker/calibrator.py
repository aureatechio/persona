"""
Calibrator — correção suave baseada em pesquisas reais.
Compara nosso polling com pesquisas de institutos e aplica micro-correções.
"""
from __future__ import annotations

from config import settings
from db_updater import DBUpdater
from delta_computer import compute_calibration_delta
from polling_fetcher import PollingFetcher


class Calibrator:
    def __init__(self, db: DBUpdater, polling_fetcher: PollingFetcher):
        self._db = db
        self._polling = polling_fetcher

    def run_calibration(self, cycle_id: str) -> dict:
        """
        Compara nosso polling com pesquisa real e aplica correção suave.
        Retorna relatório de calibração.
        """
        report = {"corrections": [], "anchor": None, "skipped": False}

        # 1. Buscar âncora mais recente
        anchor = self._polling.get_latest_anchor("1turno")
        if not anchor:
            print("[Calibrator] Sem pesquisa âncora recente (< 7 dias)")
            report["skipped"] = True
            return report

        report["anchor"] = {
            "source": anchor["source"],
            "date": str(anchor["poll_date"]),
            "results": anchor["results"],
        }

        # 2. Obter nosso polling atual
        our_polling = self._db.get_current_polling()

        real_results = anchor["results"]

        # 3. Para cada candidato, verificar erro e corrigir
        for candidate_id, real_pct in real_results.items():
            our_pct = our_polling.get(candidate_id, 0)
            error = float(real_pct) - our_pct

            delta = compute_calibration_delta(our_pct, float(real_pct))

            correction_info = {
                "candidate": candidate_id,
                "real": float(real_pct),
                "ours": our_pct,
                "error": round(error, 2),
                "delta": round(delta, 4),
                "applied": False,
            }

            if abs(delta) < 0.001:
                correction_info["reason"] = f"Dentro da margem ({settings.polling_error_threshold}%)"
                report["corrections"].append(correction_info)
                continue

            # Aplicar correção preferencialmente nos clusters moderados
            cluster_weights = {
                "M": 0.5,   # moderados recebem mais (swing voters)
                "T": 0.25,  # transversais recebem um pouco
                "P": 0.15 if delta > 0 else 0.05,  # progressistas mais se delta positivo p/ esquerda
                "C": 0.15 if delta < 0 else 0.05,  # conservadores mais se delta positivo p/ direita
            }

            # Ajustar pesos para somar 1.0
            total_weight = sum(cluster_weights.values())
            cluster_weights = {k: v / total_weight for k, v in cluster_weights.items()}

            total_affected = 0
            for macro, weight in cluster_weights.items():
                cluster_delta = delta * weight
                if abs(cluster_delta) < 0.0005:
                    continue

                affected = self._db.apply_sentiment_delta(macro, candidate_id, cluster_delta)
                total_affected += affected

                self._db.log_sentiment_update(
                    news_event_id=None,
                    cycle_id=cycle_id,
                    cluster_id=f"{macro}%",
                    candidate_id=candidate_id,
                    delta=cluster_delta,
                    personas_affected=affected,
                    reasoning=f"calibracao_pesquisa:{anchor['source']}",
                )

            correction_info["applied"] = True
            correction_info["personas_affected"] = total_affected
            report["corrections"].append(correction_info)

            print(f"[Calibrator] {candidate_id}: erro={error:+.1f}%, delta={delta:+.4f}, {total_affected} personas")

        return report
