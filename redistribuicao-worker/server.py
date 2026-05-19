"""
Redistribuição Worker — Python backend for vote redistribution analysis.
Loads all personas from Supabase, runs GPT analysis in parallel batches,
caches ranked votes so redistribution is instant.

Run: uvicorn server:app --port 3010 --reload
"""

import asyncio
import json
import os
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from supabase import create_client

# ── Load env from parent .env.local ──────────────────────────────────────────

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').strip('"')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip('"')
OPENAI_KEY = os.getenv('OPENAI_API_KEY', '').strip('"').split('\n')[0].strip('"')

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
oai = AsyncOpenAI(api_key=OPENAI_KEY)

# ── Candidates ────────────────────────────────────────────────────────────────

CANDIDATES = [
    {"id": "lula", "name": "Lula", "party": "PT", "position": "Presidente", "leaning": "esquerda"},
    {"id": "flavio", "name": "Flávio Bolsonaro", "party": "PL", "position": "Senador", "leaning": "direita"},
    {"id": "ratinho", "name": "Ratinho Jr.", "party": "PSD", "position": "Governador PR", "leaning": "centro-direita"},
    {"id": "caiado", "name": "Ronaldo Caiado", "party": "União Brasil", "position": "Governador GO", "leaning": "direita"},
]

CANDIDATE_IDS = {c["id"] for c in CANDIDATES}

# ── Cache ─────────────────────────────────────────────────────────────────────

cached_votes: dict[str, list[str]] = {}  # persona_id -> [1st, 2nd, 3rd, 4th]
cached_personas_count: int = 0
cache_ready = False
cache_lock = asyncio.Lock()
progress = {"loaded": 0, "total": 0, "voted": 0, "status": "idle"}

# ── Persona Fields ────────────────────────────────────────────────────────────

FIELDS = (
    "id,name,age,city,state,gender,raca_cor,education_level,generation,"
    "political_leaning,macro_religion,archetype_primary,cluster_id,nome_grupo,"
    "score_economico,score_costumes,social_class,area_type,region_br,"
    "civil_status,voto_2022,aprovacao_lula,voto_2026,q_avaliacao_bolsonaro,"
    "career_json,beliefs_json"
)


# ── GPT Prompt ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é um MOTOR DE SIMULAÇÃO ELEITORAL para pesquisa social.
Recebe perfis de eleitores brasileiros e simula como votariam numa eleição presidencial.

CANDIDATOS E POSICIONAMENTO:
• Lula (PT) — ESQUERDA: estado forte, programas sociais, regulação, redistribuição de renda
• Flávio Bolsonaro (PL) — DIREITA: conservador, família tradicional, armas, anti-PT, bolsonarismo
• Ratinho Jr. (PSD) — CENTRO-DIREITA: gestão eficiente, pragmático, conservador moderado
• Ronaldo Caiado (União Brasil) — DIREITA: agronegócio, conservador, anti-esquerda, ruralista

REGRAS DE VOTAÇÃO:
1. score_economico NEGATIVO (esquerda) → tende a votar LULA
2. score_economico POSITIVO (direita) → tende a votar FLÁVIO, CAIADO ou RATINHO
3. O RANKING deve respeitar PROXIMIDADE IDEOLÓGICA:
   - Eleitor de ESQUERDA: ranking próximo = lula > ratinho > caiado > flavio (ou abstain)
   - Eleitor de DIREITA: ranking próximo = flavio/caiado > ratinho > lula (ou abstain)
   - Eleitor de CENTRO-DIREITA: ratinho > flavio/caiado > lula
4. voto_2022, aprovacao_lula e avaliacao_bolsonaro são indicadores DECISIVOS
5. Evangélicos conservadores → tendem a direita (Flávio/Caiado)
6. Cluster T1 (Desengajado) → pode colocar "abstain" como 1º

IMPORTANTE: A 2ª escolha deve ser IDEOLOGICAMENTE PRÓXIMA da 1ª.
Se alguém vota em Ratinho (centro-direita), a 2ª opção é Flávio ou Caiado, NÃO Lula.
Se alguém vota em Lula (esquerda), a 2ª opção pode ser Ratinho (mais moderado), NÃO Flávio.

FORMATO JSON — APENAS ISSO:
[{"id": "persona_id", "ranking": ["1st_choice", "2nd_choice", "3rd_choice", "4th_choice"]}]

IDs válidos: lula, flavio, ratinho, caiado, abstain
NÃO inclua explicações."""


def summarize_persona(p: dict) -> str:
    """One-line summary of persona for GPT."""
    parts = [
        f"[{p['id']}]",
        f"{p.get('name','?')} | {p.get('gender','?')}, {p.get('age','?')}a, {p.get('raca_cor','?')}",
        f"{p.get('city','?')}/{p.get('state','?')} ({p.get('region_br','?')}, {p.get('area_type','?')})",
        f"{p.get('generation','?')}",
        f"Esc:{p.get('education_level','?')}",
        f"Classe {p.get('social_class','?')}",
        f"Pol:{p.get('political_leaning','?')}",
        f"Rel:{p.get('macro_religion','?')}",
        f"Cluster:{p.get('cluster_id','?')}({p.get('nome_grupo','?')})",
        f"ScoreEco:{p.get('score_economico','?')}",
        f"ScoreCost:{p.get('score_costumes','?')}",
    ]
    if p.get('voto_2022'):
        parts.append(f"Voto2022:{p['voto_2022']}")
    if p.get('aprovacao_lula'):
        parts.append(f"AprovLula:{p['aprovacao_lula']}")
    if p.get('voto_2026'):
        parts.append(f"Voto2026:{p['voto_2026']}")
    if p.get('q_avaliacao_bolsonaro'):
        parts.append(f"AvalBolso:{p['q_avaliacao_bolsonaro']}")
    if p.get('archetype_primary'):
        parts.append(f"Arq:{p['archetype_primary']}")

    beliefs = p.get('beliefs_json') or {}
    pos = beliefs.get('posicionamentos_politicos') or {}
    themes = []
    if pos.get('aborto'):
        themes.append(f"Aborto:{pos['aborto']}")
    if pos.get('armas'):
        themes.append(f"Armas:{pos['armas']}")
    if pos.get('privatizacoes'):
        themes.append(f"Priv:{pos['privatizacoes']}")
    if themes:
        parts.append(' '.join(themes))

    return ' | '.join(parts)


def build_prompt(personas: list[dict]) -> str:
    cand_block = '\n'.join(
        f"• {c['id']}: {c['name']} ({c['party']}) — {c['position']} — {c['leaning']}"
        for c in CANDIDATES
    )
    persona_block = '\n'.join(summarize_persona(p) for p in personas)
    return (
        f"CANDIDATOS:\n{cand_block}\n\n"
        f"ELEITORES ({len(personas)} personas):\n{persona_block}\n\n"
        f"Simule o RANKING de preferência de cada eleitor. Responda APENAS JSON."
    )


# ── Load & Analyze ───────────────────────────────────────────────────────────

async def load_all_personas() -> list[dict]:
    """Load all personas from Supabase in batches."""
    count_resp = sb.table('personas').select('id', count='exact').execute()
    total = count_resp.count or 1000
    progress["total"] = total

    all_personas = []
    batch_size = 1000
    for offset in range(0, total, batch_size):
        resp = sb.table('personas').select(FIELDS).range(offset, offset + batch_size - 1).execute()
        if resp.data:
            all_personas.extend(resp.data)
        progress["loaded"] = len(all_personas)
        print(f"[Load] {len(all_personas)}/{total} personas")

    return all_personas


async def analyze_batch(batch: list[dict], semaphore: asyncio.Semaphore) -> list[dict]:
    """Send one batch to GPT and parse ranked results."""
    async with semaphore:
        try:
            prompt = build_prompt(batch)
            resp = await oai.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=8192,
                temperature=0.7,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            text = (resp.choices[0].message.content or "[]").strip()
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(text)
        except Exception as e:
            print(f"[GPT] Batch error: {e}")
            return []


async def run_full_analysis():
    """Load all personas and run GPT ranking analysis."""
    global cached_votes, cached_personas_count, cache_ready

    progress["status"] = "loading"
    personas = await load_all_personas()
    cached_personas_count = len(personas)

    progress["status"] = "analyzing"
    print(f"[Analysis] Starting GPT analysis of {len(personas)} personas...")
    start = time.time()

    # Batch: 50 personas per GPT call, 80 concurrent
    # 50 is the sweet spot — 100 causes GPT to truncate JSON output
    BATCH_SIZE = 50
    MAX_CONCURRENT = 80
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    batches = [personas[i:i + BATCH_SIZE] for i in range(0, len(personas), BATCH_SIZE)]
    print(f"[Analysis] {len(batches)} batches of {BATCH_SIZE}, max {MAX_CONCURRENT} concurrent")

    tasks = [analyze_batch(b, semaphore) for b in batches]

    results = []
    done_count = 0
    for coro in asyncio.as_completed(tasks):
        batch_result = await coro
        results.append(batch_result)
        done_count += 1
        progress["voted"] = min(done_count * BATCH_SIZE, len(personas))
        if done_count % 10 == 0:
            elapsed = time.time() - start
            print(f"[Analysis] {done_count}/{len(batches)} batches done ({elapsed:.1f}s)")

    # Retry failed batches (those that returned empty)
    failed_indices = [i for i, r in enumerate(results) if len(r) == 0]
    if failed_indices:
        print(f"[Analysis] Retrying {len(failed_indices)} failed batches...")
        retry_tasks = [analyze_batch(batches[i], semaphore) for i in failed_indices]
        for i, coro in zip(failed_indices, asyncio.as_completed(retry_tasks)):
            results[i] = await coro

    # Parse into cache
    new_cache: dict[str, list[str]] = {}
    for batch_result in results:
        for item in batch_result:
            pid = str(item.get("id", ""))
            ranking = item.get("ranking", [])
            # Validate ranking
            valid = [r for r in ranking if r in CANDIDATE_IDS or r == "abstain"]
            if pid and valid:
                new_cache[pid] = valid

    cached_votes = new_cache
    cache_ready = True
    elapsed = time.time() - start
    progress["status"] = "ready"
    print(f"[Analysis] Done! {len(new_cache)} personas analyzed in {elapsed:.1f}s")

    # Log distribution
    dist: dict[str, int] = {}
    for ranking in new_cache.values():
        first = ranking[0] if ranking else "unknown"
        dist[first] = dist.get(first, 0) + 1
    print(f"[Analysis] 1st choice distribution: {dist}")


# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="Redistribuição Worker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Start analysis on server boot."""
    asyncio.create_task(run_full_analysis())


@app.get("/status")
async def status():
    return {
        "ready": cache_ready,
        "progress": progress,
        "totalPersonas": cached_personas_count,
        "totalVoted": len(cached_votes),
    }


@app.get("/election")
async def election(exclude: Optional[str] = None):
    """
    Get election results. Optionally exclude one or more candidates.
    ?exclude=lula or ?exclude=lula,ratinho
    """
    if not cache_ready:
        return {"error": "Analysis in progress", "progress": progress}

    excluded = set(exclude.split(",")) if exclude else set()
    active_ids = CANDIDATE_IDS - excluded

    # Tally votes from cached rankings
    votes: dict[str, int] = {cid: 0 for cid in active_ids}
    abstentions = 0

    for pid, ranking in cached_votes.items():
        # Find first valid choice among active candidates
        voted = False
        for choice in ranking:
            if choice in active_ids:
                votes[choice] += 1
                voted = True
                break
            if choice == "abstain":
                abstentions += 1
                voted = True
                break
        if not voted:
            abstentions += 1

    total_voters = sum(votes.values())

    results = []
    for c in CANDIDATES:
        if c["id"] in excluded:
            continue
        v = votes.get(c["id"], 0)
        results.append({
            "id": c["id"],
            "name": c["name"],
            "party": c["party"],
            "leaning": c["leaning"],
            "votes": v,
            "percent": round(v / total_voters * 100, 1) if total_voters > 0 else 0,
        })

    results.sort(key=lambda x: x["votes"], reverse=True)

    return {
        "totalPersonas": cached_personas_count,
        "totalVoters": total_voters,
        "totalAbstentions": abstentions,
        "excluded": list(excluded),
        "candidates": results,
    }


@app.get("/redistribution/{removed_id}")
async def redistribution(removed_id: str):
    """
    Show redistribution when a candidate is removed.
    Returns before/after comparison.
    """
    if not cache_ready:
        return {"error": "Analysis in progress", "progress": progress}

    if removed_id not in CANDIDATE_IDS:
        return {"error": f"Unknown candidate: {removed_id}"}

    # Before: full election
    before_resp = await election(exclude=None)
    before_map = {c["id"]: c for c in before_resp["candidates"]}

    # After: without removed candidate
    after_resp = await election(exclude=removed_id)
    after_map = {c["id"]: c for c in after_resp["candidates"]}

    removed = before_map.get(removed_id, {})

    candidates = []
    for c in after_resp["candidates"]:
        before = before_map.get(c["id"], {})
        gained = c["votes"] - before.get("votes", 0)
        candidates.append({
            **c,
            "votesBefore": before.get("votes", 0),
            "percentBefore": before.get("percent", 0),
            "votesAfter": c["votes"],
            "percentAfter": c["percent"],
            "gained": max(0, gained),
            "delta": round(c["percent"] - before.get("percent", 0), 1),
        })

    candidates.sort(key=lambda x: x["gained"], reverse=True)

    total_redistributed = removed.get("votes", 0)
    for c in candidates:
        c["percentOfRedistribution"] = (
            round(c["gained"] / total_redistributed * 100, 1)
            if total_redistributed > 0 else 0
        )

    return {
        "removedCandidate": {
            "id": removed_id,
            "name": removed.get("name", ""),
            "party": removed.get("party", ""),
            "votes": removed.get("votes", 0),
            "percent": removed.get("percent", 0),
        },
        "totalVoters": after_resp["totalVoters"],
        "totalAbstentions": after_resp["totalAbstentions"],
        "totalRedistributed": total_redistributed,
        "candidates": candidates,
    }
