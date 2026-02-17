"""
Electoral Engine — orquestra o pipeline eleitoral completo.

Pipeline:
  1. Web Research (notícias atuais dos candidatos)
  2. Context Builder (IA cria contexto factual)
  3. Persona Voting (batches com Claude/GPT)
  4. Criticism Extraction (IA agrupa críticas)
  5. Proposal Generation (IA gera contra-propostas)
"""
from __future__ import annotations

import asyncio
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

import anthropic
import openai

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult
from arena_analysis.electoral_prompts import (
    ELECTORAL_SYSTEM_PROMPT,
    CRITICISM_EXTRACTOR_PROMPT,
    PROPOSAL_GENERATOR_PROMPT,
    build_electoral_batch_prompt,
    build_criticism_extraction_prompt,
    build_proposal_generation_prompt,
)
from arena_analysis.results_aggregator import (
    CLUSTER_MACROS,
    CLUSTER_NAMES,
    QUADRANT_LABELS,
)


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ElectoralVote:
    persona_id: str
    vote: str  # "candidateA" | "candidateB" | "abstain"
    confidence: float
    comment: str
    criticisms: list[str] = field(default_factory=list)


@dataclass
class ElectoralBatchProgress:
    processed: int
    total: int
    votes_a: int
    votes_b: int
    abstentions: int
    results: list[ElectoralVote]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _chunk_list(lst: list, size: int) -> list[list]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _clean_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```json?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text


def _classify_quadrant(score_eco: float, score_cost: float) -> str:
    if score_eco <= 0 and score_cost <= 0:
        return "esq_progressista"
    if score_eco <= 0 and score_cost > 0:
        return "esq_conservador"
    if score_eco > 0 and score_cost > 0:
        return "dir_conservador"
    return "dir_progressista"


def _parse_electoral_response(
    raw: str, personas: list[dict[str, Any]]
) -> list[ElectoralVote]:
    text = _clean_json(raw)
    parsed = json.loads(text)
    results = []

    for i, item in enumerate(parsed):
        if i >= len(personas):
            break
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))

        vote = item.get("vote", "abstain")
        if vote not in ("candidateA", "candidateB", "abstain"):
            vote = "abstain"

        confidence = float(item.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        criticisms = item.get("criticisms", [])
        if not isinstance(criticisms, list):
            criticisms = []

        results.append(ElectoralVote(
            persona_id=pid,
            vote=vote,
            confidence=confidence,
            comment=item.get("comment", ""),
            criticisms=criticisms,
        ))

    # Fill missing personas
    for i in range(len(results), len(personas)):
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))
        results.append(ElectoralVote(
            persona_id=pid, vote="abstain", confidence=0.3,
            comment="sei la", criticisms=[],
        ))

    return results


def _fallback_votes(personas: list[dict[str, Any]]) -> list[ElectoralVote]:
    results = []
    for p in personas:
        pid = str(p.get("id", p.get("name", "unknown")))
        eco = float(p.get("score_economico") or 0)
        if eco < -0.2:
            vote = "candidateA"
        elif eco > 0.2:
            vote = "candidateB"
        else:
            vote = "abstain"
        results.append(ElectoralVote(
            persona_id=pid, vote=vote, confidence=0.5,
            comment="...", criticisms=[],
        ))
    return results


# ── Electoral Engine ──────────────────────────────────────────────────────────

class ElectoralEngine:
    def __init__(self):
        # Claude async clients — 1 por chave
        self._claude_clients: list[anthropic.AsyncAnthropic] = [
            anthropic.AsyncAnthropic(api_key=key)
            for key in settings.anthropic_api_keys
        ]
        self._has_claude = len(self._claude_clients) > 0

        # OpenAI async clients — 1 por chave
        self._openai_clients: list[openai.AsyncOpenAI] = [
            openai.AsyncOpenAI(api_key=key)
            for key in settings.openai_api_keys
        ]
        self._has_openai = len(self._openai_clients) > 0

    # ── Claude voting batch ───────────────────────────────────────────────
    async def _vote_claude(
        self,
        prompt: str,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        client: anthropic.AsyncAnthropic,
        key_id: int = 0,
    ) -> list[ElectoralVote]:
        tag = f"Electoral-Claude-{key_id+1}"
        max_retries = 3
        async with semaphore:
            for attempt in range(max_retries + 1):
                try:
                    response = await client.messages.create(
                        model=settings.model,
                        max_tokens=settings.max_tokens_per_batch,
                        system=ELECTORAL_SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=1.0,
                    )
                    text_block = next(
                        (b for b in response.content if b.type == "text"), None
                    )
                    if not text_block:
                        raise ValueError("No text block")
                    return _parse_electoral_response(text_block.text, personas)

                except json.JSONDecodeError:
                    if attempt < 2:
                        print(f"[{tag}] JSON error, retry {attempt+1}/2...")
                        await asyncio.sleep(2)
                        continue
                    return _fallback_votes(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e) or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 5 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r}...")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {e}")
                    return _fallback_votes(personas)
        return _fallback_votes(personas)

    # ── OpenAI voting batch ───────────────────────────────────────────────
    async def _vote_openai(
        self,
        prompt: str,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        client: openai.AsyncOpenAI,
        key_id: int = 0,
    ) -> list[ElectoralVote]:
        tag = f"Electoral-GPT-{key_id+1}"
        max_retries = 3
        async with semaphore:
            for attempt in range(max_retries + 1):
                try:
                    response = await client.chat.completions.create(
                        model=settings.openai_model,
                        max_tokens=settings.max_tokens_per_batch,
                        messages=[
                            {"role": "system", "content": ELECTORAL_SYSTEM_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        temperature=1.0,
                    )
                    raw = response.choices[0].message.content or ""
                    return _parse_electoral_response(raw, personas)

                except json.JSONDecodeError:
                    if attempt < 2:
                        print(f"[{tag}] JSON error, retry {attempt+1}/2...")
                        await asyncio.sleep(2)
                        continue
                    return _fallback_votes(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e) or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 3 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r}...")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {e}")
                    return _fallback_votes(personas)
        return _fallback_votes(personas)

    # ── Run voting loop ───────────────────────────────────────────────────
    async def run_voting(
        self,
        candidate_a: dict,
        candidate_b: dict,
        context_a: ContextResult | None,
        context_b: ContextResult | None,
        personas: list[dict[str, Any]],
        proposals: list[dict] | None = None,
        loser_name: str | None = None,
    ) -> AsyncGenerator[ElectoralBatchProgress, None]:
        total = len(personas)
        batches = _chunk_list(personas, settings.batch_size)
        num_gpt_keys = len(self._openai_clients)

        num_claude_keys = len(self._claude_clients)

        # Split batches between Claude and GPT
        if self._has_openai:
            split = max(1, int(len(batches) * settings.claude_share))
            claude_batches = batches[:split]
            gpt_batches = batches[split:]

            # Round-robin Claude batches entre as chaves
            claude_groups: list[list[list]] = [[] for _ in range(num_claude_keys)]
            for i, batch in enumerate(claude_batches):
                claude_groups[i % num_claude_keys].append(batch)

            # Round-robin GPT batches entre as chaves
            gpt_groups: list[list[list]] = [[] for _ in range(num_gpt_keys)]
            for i, batch in enumerate(gpt_batches):
                gpt_groups[i % num_gpt_keys].append(batch)
        else:
            claude_groups = [[] for _ in range(num_claude_keys)]
            for i, batch in enumerate(batches):
                claude_groups[i % num_claude_keys].append(batch)
            gpt_groups = []

        sem_claude = asyncio.Semaphore(settings.max_parallel_claude)
        sem_openai = asyncio.Semaphore(settings.max_parallel_openai)

        processed = 0
        votes_a = 0
        votes_b = 0
        abstentions = 0

        # Launch all tasks
        all_tasks = []

        for key_id, group in enumerate(claude_groups):
            client = self._claude_clients[key_id]
            for batch in group:
                prompt = build_electoral_batch_prompt(
                    candidate_a, candidate_b, context_a, context_b,
                    batch, proposals, loser_name,
                )
                all_tasks.append(self._vote_claude(prompt, batch, sem_claude, client, key_id))

        for key_id, group in enumerate(gpt_groups):
            client = self._openai_clients[key_id]
            for batch in group:
                prompt = build_electoral_batch_prompt(
                    candidate_a, candidate_b, context_a, context_b,
                    batch, proposals, loser_name,
                )
                all_tasks.append(self._vote_openai(prompt, batch, sem_openai, client, key_id))

        print(f"[ElectoralEngine] {total} personas, {len(batches)} batches launched")

        for coro in asyncio.as_completed(all_tasks):
            batch_results = await coro

            for r in batch_results:
                processed += 1
                if r.vote == "candidateA":
                    votes_a += 1
                elif r.vote == "candidateB":
                    votes_b += 1
                else:
                    abstentions += 1

            yield ElectoralBatchProgress(
                processed=processed,
                total=total,
                votes_a=votes_a,
                votes_b=votes_b,
                abstentions=abstentions,
                results=batch_results,
            )

        print(f"[ElectoralEngine] Done: {processed}/{total} | A={votes_a} B={votes_b} Abs={abstentions}")

    # ── Extract criticisms ────────────────────────────────────────────────
    async def extract_criticisms(
        self,
        winner_name: str,
        winner_party: str,
        votes: list[ElectoralVote],
        personas: list[dict[str, Any]],
        winner_side: str,
    ) -> list[dict]:
        # Collect all criticisms from winner's voters
        persona_map = {str(p.get("id", "")): p for p in personas}
        all_criticisms = []
        cluster_criticism_map: dict[str, list[str]] = defaultdict(list)

        for vote in votes:
            if vote.vote != winner_side:
                continue
            if not vote.criticisms:
                continue
            all_criticisms.extend(vote.criticisms)
            persona = persona_map.get(vote.persona_id, {})
            cid = persona.get("cluster_id", "?")
            cluster_criticism_map[cid].extend(vote.criticisms)

        if not all_criticisms:
            print("[ElectoralEngine] No criticisms found")
            return []

        prompt = build_criticism_extraction_prompt(
            winner_name, winner_party, all_criticisms, dict(cluster_criticism_map),
        )

        try:
            response = await self._claude_clients[0].messages.create(
                model=settings.model,
                max_tokens=4096,
                system=CRITICISM_EXTRACTOR_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            text = next((b.text for b in response.content if b.type == "text"), "[]")
            parsed = json.loads(_clean_json(text))

            # Add voter counts
            from collections import Counter
            crit_counts = Counter(all_criticisms)
            for cat in parsed:
                # Estimate voter count by matching keywords
                count = 0
                cat_lower = cat.get("category", "").lower()
                for crit, n in crit_counts.items():
                    if cat_lower in crit.lower() or any(
                        word in crit.lower()
                        for word in cat_lower.split()
                        if len(word) > 3
                    ):
                        count += n
                cat["voterCount"] = count if count > 0 else len(all_criticisms) // len(parsed)

            print(f"[ElectoralEngine] Extracted {len(parsed)} criticism categories")
            return parsed

        except Exception as e:
            print(f"[ElectoralEngine] Criticism extraction error: {e}")
            return []

    # ── Generate proposals ────────────────────────────────────────────────
    async def generate_proposals(
        self,
        loser: dict,
        winner: dict,
        margin: int,
        criticisms: list[dict],
        total_voters: int,
    ) -> list[dict]:
        prompt = build_proposal_generation_prompt(
            loser, winner, margin, criticisms, total_voters,
        )

        try:
            response = await self._claude_clients[0].messages.create(
                model=settings.model,
                max_tokens=4096,
                system=PROPOSAL_GENERATOR_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
            )
            text = next((b.text for b in response.content if b.type == "text"), "[]")
            parsed = json.loads(_clean_json(text))

            # Add IDs and enabled flag
            for i, p in enumerate(parsed):
                p["id"] = f"proposal_{i+1}"
                p["enabled"] = True

            print(f"[ElectoralEngine] Generated {len(parsed)} proposals")
            return parsed

        except Exception as e:
            print(f"[ElectoralEngine] Proposal generation error: {e}")
            return []

    # ── Aggregate results ─────────────────────────────────────────────────
    def aggregate_electoral_results(
        self,
        candidate_a: dict,
        candidate_b: dict,
        personas: list[dict[str, Any]],
        votes: list[ElectoralVote],
        round_number: int,
    ) -> dict[str, Any]:
        vote_map: dict[str, ElectoralVote] = {v.persona_id: v for v in votes}

        total = len(personas)
        total_a = 0
        total_b = 0
        total_abs = 0

        cluster_data: dict[str, dict] = defaultdict(
            lambda: {"total": 0, "votesA": 0, "votesB": 0, "abstentions": 0}
        )
        region_data: dict[str, dict] = defaultdict(
            lambda: {"total": 0, "votesA": 0, "votesB": 0, "abstentions": 0}
        )
        generation_data: dict[str, dict] = defaultdict(
            lambda: {"total": 0, "votesA": 0, "votesB": 0, "abstentions": 0, "total_age": 0}
        )
        quadrant_data: dict[str, dict] = defaultdict(
            lambda: {"total": 0, "votesA": 0, "votesB": 0, "abstentions": 0}
        )

        all_votes_list = []

        for persona in personas:
            pid = str(persona.get("id", ""))
            vote_data = vote_map.get(pid)

            if not vote_data:
                vote_val = "abstain"
                confidence = 0.3
                comment = ""
                criticisms = []
            else:
                vote_val = vote_data.vote
                confidence = vote_data.confidence
                comment = vote_data.comment
                criticisms = vote_data.criticisms

            if vote_val == "candidateA":
                total_a += 1
            elif vote_val == "candidateB":
                total_b += 1
            else:
                total_abs += 1

            # Cluster
            cid = persona.get("cluster_id") or "unknown"
            cluster_data[cid]["total"] += 1
            if vote_val == "candidateA":
                cluster_data[cid]["votesA"] += 1
            elif vote_val == "candidateB":
                cluster_data[cid]["votesB"] += 1
            else:
                cluster_data[cid]["abstentions"] += 1

            # Region
            region = persona.get("region_br") or "Não informado"
            region_data[region]["total"] += 1
            if vote_val == "candidateA":
                region_data[region]["votesA"] += 1
            elif vote_val == "candidateB":
                region_data[region]["votesB"] += 1
            else:
                region_data[region]["abstentions"] += 1

            # Generation
            gen = persona.get("generation") or "Não informado"
            generation_data[gen]["total"] += 1
            generation_data[gen]["total_age"] += int(persona.get("age") or 0)
            if vote_val == "candidateA":
                generation_data[gen]["votesA"] += 1
            elif vote_val == "candidateB":
                generation_data[gen]["votesB"] += 1
            else:
                generation_data[gen]["abstentions"] += 1

            # Quadrant
            eco = float(persona.get("score_economico") or 0)
            cost = float(persona.get("score_costumes") or 0)
            quadrant = _classify_quadrant(eco, cost)
            quadrant_data[quadrant]["total"] += 1
            if vote_val == "candidateA":
                quadrant_data[quadrant]["votesA"] += 1
            elif vote_val == "candidateB":
                quadrant_data[quadrant]["votesB"] += 1
            else:
                quadrant_data[quadrant]["abstentions"] += 1

            # Build vote object
            all_votes_list.append({
                "personaId": pid,
                "personaName": persona.get("name", "Anônimo"),
                "age": persona.get("age", 0),
                "state": persona.get("state", ""),
                "region": region,
                "generation": gen,
                "educationLevel": persona.get("education_level", ""),
                "clusterId": cid,
                "clusterName": persona.get("nome_grupo", ""),
                "scoreEco": eco,
                "scoreCost": cost,
                "politicalLeaning": persona.get("political_leaning", ""),
                "vote": vote_val,
                "confidence": confidence,
                "comment": comment,
                "criticisms": criticisms,
            })

        # Build cluster results
        effective_total = total_a + total_b
        by_cluster = []
        for cid, data in cluster_data.items():
            by_cluster.append({
                "clusterId": cid,
                "clusterName": CLUSTER_NAMES.get(cid, cid),
                "macro": CLUSTER_MACROS.get(cid, "Transversal"),
                **data,
            })
        by_cluster.sort(key=lambda c: c["clusterId"])

        # Build region results
        by_region = [{"region": r, **data} for r, data in region_data.items()]
        by_region.sort(key=lambda x: x["total"], reverse=True)

        # Build generation results
        by_generation = []
        for gen, data in generation_data.items():
            by_generation.append({
                "generation": gen,
                "total": data["total"],
                "votesA": data["votesA"],
                "votesB": data["votesB"],
                "abstentions": data["abstentions"],
                "avgAge": round(data["total_age"] / data["total"]) if data["total"] else 0,
            })

        # Build quadrant results
        by_quadrant = []
        for q, data in quadrant_data.items():
            by_quadrant.append({
                "quadrant": q,
                "label": QUADRANT_LABELS.get(q, q),
                **data,
            })

        winner = "tie"
        if total_a > total_b:
            winner = "candidateA"
        elif total_b > total_a:
            winner = "candidateB"

        return {
            "roundNumber": round_number,
            "totalVoters": total,
            "votesA": total_a,
            "votesB": total_b,
            "abstentions": total_abs,
            "percentA": round(total_a / effective_total * 100, 1) if effective_total > 0 else 0,
            "percentB": round(total_b / effective_total * 100, 1) if effective_total > 0 else 0,
            "votes": all_votes_list,
            "byCluster": by_cluster,
            "byRegion": by_region,
            "byGeneration": by_generation,
            "byQuadrant": by_quadrant,
            "winner": winner,
            "processingTime": 0,
        }

    # ── Compute voter shifts ──────────────────────────────────────────────
    def compute_shifts(
        self,
        previous_votes: dict[str, str],
        current_votes: list[ElectoralVote],
        personas: list[dict[str, Any]],
    ) -> list[dict]:
        persona_map = {str(p.get("id", "")): p for p in personas}
        shifts = []

        for vote in current_votes:
            prev = previous_votes.get(vote.persona_id)
            if prev and prev != vote.vote:
                persona = persona_map.get(vote.persona_id, {})
                shifts.append({
                    "personaId": vote.persona_id,
                    "personaName": persona.get("name", "Anônimo"),
                    "age": persona.get("age", 0),
                    "state": persona.get("state", ""),
                    "clusterId": persona.get("cluster_id", "?"),
                    "clusterName": persona.get("nome_grupo", "?"),
                    "generation": persona.get("generation", "?"),
                    "previousVote": prev,
                    "newVote": vote.vote,
                    "reason": vote.comment,
                })

        print(f"[ElectoralEngine] {len(shifts)} voter shifts detected")
        return shifts
