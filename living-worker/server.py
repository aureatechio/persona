"""
Living Worker — FastAPI server com APScheduler para atualização 3x/dia.

Endpoints:
  GET  /health         — health check
  GET  /status         — último ciclo, próximo run
  GET  /candidates     — candidatos com polling
  POST /trigger        — trigger manual de ciclo
  GET  /cycles         — histórico de ciclos
  GET  /drift          — drift report
  POST /rollback/{id}  — rollback de ciclo
"""
from __future__ import annotations

import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from calibrator import Calibrator
from db_updater import DBUpdater
from delta_computer import compute_segment_delta, compute_cross_delta
from impact_analyzer import ImpactAnalyzer
from news_fetcher import NewsFetcher
from polling_fetcher import PollingFetcher
from safety import SafetyGuard


# ── Global instances ──────────────────────────────────────────────────────────

news_fetcher = NewsFetcher()
impact_analyzer = ImpactAnalyzer()
polling_fetcher = PollingFetcher()
db = DBUpdater()
safety = SafetyGuard()
calibrator = Calibrator(db, polling_fetcher)

scheduler = AsyncIOScheduler()


# ── Core pipeline ─────────────────────────────────────────────────────────────

async def run_update_cycle(is_morning: bool = False):
    """
    Ciclo completo de atualização de sentimentos.
    Roda 3x/dia (07h, 13h, 19h BRT).
    """
    cycle_id = db.create_cycle()
    print(f"\n{'='*60}")
    print(f"[Living] Ciclo iniciado: {cycle_id}")
    print(f"{'='*60}")

    try:
        # 1. Snapshot pré-atualização
        snapshot_id = safety.create_snapshot(f"pre-cycle-{cycle_id[:8]}")

        # 2. Buscar notícias
        news_items = news_fetcher.fetch_all_candidates()
        print(f"[Living] {len(news_items)} notícias novas encontradas")

        news_applied = 0
        news_skipped = 0
        total_updates = 0
        candidates = {c["id"]: c for c in db.get_candidates()}

        # 3. Processar cada notícia
        for news in news_items:
            candidate = candidates.get(news.candidate_id)
            if not candidate:
                continue

            # 3a. Analisar impacto
            impact = impact_analyzer.analyze(news.headline, news.content, candidate)

            if not impact or impact.magnitude < settings.min_magnitude:
                db.save_news_event(
                    news.candidate_id, news.headline, "",
                    news.url, impact, cycle_id, "skipped",
                )
                news_skipped += 1
                continue

            # 3b. Verificar budget
            if safety.should_skip_news(news.candidate_id, impact.magnitude):
                db.save_news_event(
                    news.candidate_id, news.headline, impact.summary,
                    news.url, impact, cycle_id, "skipped",
                )
                news_skipped += 1
                print(f"[Living] Skipped (budget): {news.headline[:60]}")
                continue

            # 3c. Salvar notícia
            event_id = db.save_news_event(
                news.candidate_id, news.headline, impact.summary,
                news.url, impact, cycle_id, "applied",
            )

            # 3d. Aplicar deltas por segmento
            for segment in impact.affected_segments:
                delta = compute_segment_delta(impact.magnitude, segment)

                if abs(delta) < 0.0005:
                    continue

                affected = db.apply_sentiment_delta(
                    segment.cluster_macro, news.candidate_id, delta,
                )

                db.log_sentiment_update(
                    news_event_id=event_id,
                    cycle_id=cycle_id,
                    cluster_id=f"{segment.cluster_macro}%",
                    candidate_id=news.candidate_id,
                    delta=delta,
                    personas_affected=affected,
                    reasoning=f"{impact.news_type}:{news.headline[:50]}",
                )

                total_updates += affected

            # 3e. Efeitos cruzados (protegido contra IDs inválidos)
            for cross in impact.cross_candidate_effects:
                try:
                    cross_delta = compute_cross_delta(cross)
                    if abs(cross_delta) < 0.0005:
                        continue

                    # Aplicar em todos os clusters (efeito difuso)
                    for macro in ["P", "M", "C", "T"]:
                        affected = db.apply_sentiment_delta(macro, cross.candidate_id, cross_delta * 0.25)
                        total_updates += affected

                    db.log_sentiment_update(
                        news_event_id=event_id,
                        cycle_id=cycle_id,
                        cluster_id="ALL",
                        candidate_id=cross.candidate_id,
                        delta=cross_delta,
                        personas_affected=0,
                        reasoning=f"cross:{news.candidate_id}:{impact.news_type}",
                    )
                except Exception as e:
                    print(f"[Living] Cross-effect error (skipping): {e}")

            news_applied += 1
            print(f"[Living] Applied: {news.headline[:60]} (mag={impact.magnitude:.2f})")

        # 4. Recomputar polling + salvar histórico
        polling_before = db.get_current_polling()
        polling_result = db.compute_polling()
        polling_after = db.get_current_polling()

        # Salvar snapshot no histórico (para gráfico de tendência)
        db.save_polling_history(cycle_id)

        # 5. Calibração com pesquisas reais (1x/dia, ciclo da manhã)
        calibration_report = None
        if is_morning:
            print("[Living] Buscando pesquisas reais (ciclo manhã)...")
            polling_fetcher.fetch_real_polls()
            calibration_report = calibrator.run_calibration(cycle_id)

            # Recomputar polling após calibração
            if calibration_report and not calibration_report.get("skipped"):
                db.compute_polling()
                polling_after = db.get_current_polling()

        # 6. Detecção de novos candidatos (1x/dia)
        new_candidates = []
        if is_morning:
            snippets = news_fetcher.fetch_candidate_discovery()
            existing_ids = list(candidates.keys())
            new_candidates = impact_analyzer.extract_candidate_names(snippets, existing_ids)
            if new_candidates:
                print(f"[Living] Novos candidatos detectados: {new_candidates}")

        # 7. Finalizar ciclo
        summary = {
            "polling_before": polling_before,
            "polling_after": polling_after,
            "polling_result": polling_result,
            "calibration": calibration_report,
            "new_candidates_detected": new_candidates,
        }

        db.complete_cycle(
            cycle_id=cycle_id,
            news_count=len(news_items),
            news_applied=news_applied,
            news_skipped=news_skipped,
            updates_applied=total_updates,
            snapshot_id=snapshot_id,
            summary=summary,
        )

        print(f"\n[Living] Ciclo completo!")
        print(f"  Notícias: {len(news_items)} total, {news_applied} aplicadas, {news_skipped} skipped")
        print(f"  Updates: {total_updates} personas afetadas")
        print(f"  Polling: {polling_after}")

    except Exception as e:
        traceback.print_exc()
        db.fail_cycle(cycle_id, str(e))
        print(f"[Living] Ciclo falhou: {e}")


# ── Scheduler jobs ────────────────────────────────────────────────────────────

async def morning_cycle():
    await run_update_cycle(is_morning=True)

async def regular_cycle():
    await run_update_cycle(is_morning=False)


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 07h BRT = 10h UTC (manhã com pesquisas)
    scheduler.add_job(
        morning_cycle,
        CronTrigger(hour=10, timezone="UTC"),
        id="living_morning",
        max_instances=1,
        misfire_grace_time=3600,
    )
    # 13h BRT = 16h UTC
    scheduler.add_job(
        regular_cycle,
        CronTrigger(hour=16, timezone="UTC"),
        id="living_afternoon",
        max_instances=1,
        misfire_grace_time=3600,
    )
    # 19h BRT = 22h UTC
    scheduler.add_job(
        regular_cycle,
        CronTrigger(hour=22, timezone="UTC"),
        id="living_evening",
        max_instances=1,
        misfire_grace_time=3600,
    )
    scheduler.start()
    print("[Living] Scheduler started — cycles at 07h, 13h, 19h BRT")
    yield
    scheduler.shutdown()


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(title="Living Personas Worker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "living-worker"}


@app.get("/status")
def status():
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)

    last_cycle = sb.table("update_cycles") \
        .select("*") \
        .order("started_at", desc=True) \
        .limit(1) \
        .execute()

    jobs = scheduler.get_jobs()
    next_run = min((j.next_run_time for j in jobs if j.next_run_time), default=None)

    return {
        "last_cycle": last_cycle.data[0] if last_cycle.data else None,
        "next_run": next_run.isoformat() if next_run else None,
        "scheduler_running": scheduler.running,
    }


@app.get("/candidates")
def get_candidates():
    return db.get_candidates()


@app.post("/trigger")
async def trigger_cycle():
    """Trigger manual de ciclo (admin)."""
    await run_update_cycle(is_morning=True)
    return {"status": "completed"}


@app.get("/cycles")
def get_cycles(limit: int = 20):
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)

    result = sb.table("update_cycles") \
        .select("*") \
        .order("started_at", desc=True) \
        .limit(limit) \
        .execute()

    return result.data


@app.get("/cycles/{cycle_id}")
def get_cycle_detail(cycle_id: str):
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)

    cycle = sb.table("update_cycles") \
        .select("*") \
        .eq("id", cycle_id) \
        .single() \
        .execute()

    news = sb.table("news_events") \
        .select("*") \
        .eq("cycle_id", cycle_id) \
        .order("created_at", desc=True) \
        .execute()

    updates = sb.table("sentiment_updates") \
        .select("*") \
        .eq("cycle_id", cycle_id) \
        .execute()

    return {
        "cycle": cycle.data,
        "news_events": news.data,
        "sentiment_updates": updates.data,
    }


@app.get("/drift")
def get_drift():
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)
    result = sb.rpc("get_drift_report").execute()
    return result.data


@app.get("/anchors")
def get_anchors(limit: int = 10):
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)

    result = sb.table("polling_anchors") \
        .select("*") \
        .order("poll_date", desc=True) \
        .limit(limit) \
        .execute()

    return result.data


@app.post("/anchors")
def add_anchor(data: dict):
    """Adicionar pesquisa manualmente."""
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_key)

    row = {
        "source": data["source"],
        "poll_date": data["poll_date"],
        "scenario": data.get("scenario", "1turno"),
        "results": data["results"],
        "fetched_by": "manual",
    }

    sb.table("polling_anchors").insert(row).execute()
    return {"status": "ok"}


@app.post("/rollback/{cycle_id}")
def rollback(cycle_id: str):
    success = safety.rollback_cycle(cycle_id)
    if not success:
        raise HTTPException(status_code=400, detail="Rollback failed")
    # Recomputar polling
    db.compute_polling()
    return {"status": "rolled_back"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3020)
