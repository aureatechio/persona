"""
Calibração com IA — Cada persona decide seus sentimentos via Claude Haiku.

Cada persona recebe seu perfil completo e a IA decide o sentimento (-1.0 a +1.0)
para cada candidato, baseado em quem essa pessoa REALMENTE votaria dado seu perfil.

Uso:
  python calibrate_with_ai.py [--sample N] [--batch-size N] [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
from collections import defaultdict
from pathlib import Path

import anthropic
from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env.local"
if _env_file.exists():
    load_dotenv(_env_file)
else:
    load_dotenv(_project_root / ".env")

from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

MODEL = "claude-haiku-4-5-20251001"
MAX_PARALLEL = 8
BATCH_SIZE = 25  # personas por chamada (Haiku aguenta bem)

CANDIDATES_INFO = """
CANDIDATOS À PRESIDÊNCIA 2026 (dados reais Atlas/Bloomberg mar/2026):

1. Flávio Bolsonaro (PL) — Senador, DIREITA. Filho de Jair Bolsonaro. Lidera pesquisas.
   2º turno vs Lula: 47,6% × 46,6%. Base: evangélicos, Sul/Centro-Oeste, classe média, conservadores.

2. Lula (PT) — Presidente atual, ESQUERDA. Segundo mandato, desgaste do governo.
   1º turno: ~45,9%. Base: Nordeste, baixa renda, beneficiários sociais, sindicatos.

3. Tarcísio de Freitas (Republicanos) — Governador SP, DIREITA. Perfil gestor/técnico.
   2º turno vs Lula: 47,2% × 46,3%. Forte em SP e entre eleitores de alta escolaridade.

4. Michelle Bolsonaro (PL) — Senadora, DIREITA. Forte entre evangélicas e mulheres conservadoras.
   2º turno vs Lula: 47,0% × 46,8%.

5. Romeu Zema (Novo) — Governador MG, DIREITA LIBERAL. Perfil empresarial/liberal.
   2º turno vs Lula: 43,7% × 46,6%. Base: classe alta, liberais, MG.

6. Ronaldo Caiado (PSD) — Governador GO, DIREITA. Agronegócio, rural.
   2º turno vs Lula: 36,7% × 46,2%. Base: Centro-Oeste, ruralistas.

7. Ratinho Jr. (PSD) — Governador PR, CENTRO-DIREITA. Moderado.
   2º turno vs Lula: 38,7% × 46,1%. Base: Paraná, moderados.

8. Fernando Haddad (PT) — Ministro, ESQUERDA. Substituto de Lula se não concorrer.
   1º turno sem Lula: 37,6% × 40,1% Flávio. Base: PT, intelectuais.

9. Eduardo Leite (PSD) — Ex-Governador RS, CENTRO-DIREITA. Pouco conhecido nacionalmente.
   2º turno vs Lula: 22,7% × 45,5%.
"""

SYSTEM_PROMPT = f"""Você é um MOTOR DE SIMULAÇÃO ELEITORAL. Para cada eleitor brasileiro, analise o perfil completo e determine o SENTIMENTO real dessa pessoa em relação a cada candidato.

{CANDIDATES_INFO}

CONTEXTO POLÍTICO MARÇO 2026:
- Governo Lula com desgaste: inflação, insatisfação classe média, escândalos
- Flávio Bolsonaro lidera pesquisas pela primeira vez
- Movimento anti-incumbente forte
- Evangélicos consolidados na direita
- Nordeste ainda majoritariamente pró-Lula mas com erosão
- Classe média migrou significativamente para oposição

REGRAS DE DECISÃO:
1. Analise TODOS os campos do perfil: scores ideológicos, voto passado, religião, região, classe, escolaridade, opiniões temáticas
2. score_economico NEGATIVO = tende esquerda (Lula/Haddad)
3. score_economico POSITIVO = tende direita (Flávio/Tarcísio/Michelle)
4. score_costumes POSITIVO = conservador (favorece candidatos de direita)
5. Religião evangélica = forte tendência pró-Bolsonaro/Michelle
6. Nordeste + baixa renda + beneficiários = pró-Lula
7. Sul/Sudeste + classe média/alta = tendência oposição
8. q_corrupcao_problema + q_avaliacao_bolsonaro bom = anti-PT
9. q_bolsa_familia_bom + q_auxilio_emergencial = pró-Lula
10. Cluster T1 (desengajado) = sentimentos fracos para todos
11. Cluster T2 (anti-incumbente) = contra Lula (é o presidente)

SENTIMENTO:
-1.0 = ódio total, jamais votaria
-0.5 = desgosto, votaria contra
 0.0 = indiferente, não conhece
+0.5 = simpatia, tendência a votar
+1.0 = apoiador fervoroso, voto certo

FORMATO — responda APENAS JSON:
[{{"id": 1, "lula": 0.5, "flavio": -0.3, "tarcisio": -0.2, "michelle": -0.4, "zema": 0.0, "caiado": 0.0, "ratinho": 0.0, "haddad": 0.4, "eduardo_leite": 0.0}}]
"""

# Campos para carregar
PERSONA_FIELDS = ",".join([
    "id", "name", "age", "gender", "gender_identity",
    "education_level", "generation", "political_leaning",
    "macro_religion", "religiao_subtipo", "archetype_primary",
    "cluster_id", "nome_grupo", "score_economico", "score_costumes",
    "social_class", "area_type", "region_br", "state", "city",
    "civil_status", "raca_cor", "recebe_beneficio",
    "voto_2022", "aprovacao_lula", "voto_2026",
    "q_avaliacao_bolsonaro", "q_politico_favorito",
    "q_corrupcao_problema", "q_bolsa_familia_bom",
    "q_auxilio_emergencial_voltar", "q_estado_tamanho",
    "q_imposto_ricos", "q_intervencao_militar",
    "q_democracia_importante", "q_reforma_tributaria",
    "q_seguranca_prioridade", "q_familia_tradicional",
    "tema_casamento_gay", "q_aborto_estupro",
    "q_pena_morte", "q_racismo_estrutural", "q_meritocracia",
    "q_religiao_politica", "q_feminismo_bom",
    "q_mudanca_climatica_real", "q_amazonia_preservar",
    "q_fake_news_problema", "q_sus_funciona",
    "q_universidade_publica_gratuita", "q_direitos_lgbt",
    "q_confianca_stf", "q_confianca_congresso",
    "q_confianca_imprensa", "q_confianca_exercito", "q_confianca_igreja",
    "tema_aborto", "tema_armas", "tema_maconha", "tema_privatizacoes",
])

CANDIDATE_IDS = ["lula", "flavio", "tarcisio", "michelle", "zema", "caiado", "ratinho", "haddad", "eduardo_leite"]


def summarize_persona(p: dict, idx: int) -> str:
    """Cria resumo compacto do perfil para o prompt."""
    eco = float(p.get("score_economico") or 0)
    cost = float(p.get("score_costumes") or 0)

    parts = [
        f'[{idx}] {p.get("name","?")}',
        f'{p.get("gender_identity") or p.get("gender","?")}, {p.get("age","?")}a, {p.get("raca_cor","?")}',
        f'{p.get("state","?")} ({p.get("region_br","?")}, {p.get("area_type","?")})',
        f'{p.get("generation","?")}',
        f'Esc:{p.get("education_level","?")}',
        f'Classe:{p.get("social_class","?")}',
        f'Rel:{p.get("macro_religion","?")}',
        f'Cluster:{p.get("cluster_id","?")}({p.get("nome_grupo","?")})',
        f'ScoreEco:{eco:.2f}',
        f'ScoreCost:{cost:.2f}',
        f'Pol:{p.get("political_leaning","?")}',
    ]

    # Electoral
    extras = []
    for field, label in [
        ("voto_2022", "Voto22"), ("aprovacao_lula", "AprovLula"),
        ("voto_2026", "Voto26"), ("q_avaliacao_bolsonaro", "AvalBolso"),
        ("q_politico_favorito", "Favorito"),
    ]:
        v = p.get(field)
        if v and v != "Não respondeu":
            extras.append(f"{label}:{v}")

    # Opinions
    for field, label in [
        ("q_corrupcao_problema", "Corrupção"), ("q_bolsa_familia_bom", "BolsaFam"),
        ("q_auxilio_emergencial_voltar", "AuxEmerg"), ("q_intervencao_militar", "IntervMil"),
        ("q_familia_tradicional", "FamTradi"), ("q_seguranca_prioridade", "SegPrior"),
        ("q_religiao_politica", "ReligPol"), ("q_imposto_ricos", "ImpRicos"),
        ("q_estado_tamanho", "TamEstado"), ("q_democracia_importante", "Democracia"),
        ("q_racismo_estrutural", "RacismoEstr"), ("q_meritocracia", "Meritocr"),
        ("q_feminismo_bom", "Feminismo"), ("q_direitos_lgbt", "DirLGBT"),
        ("q_mudanca_climatica_real", "MudClima"), ("q_amazonia_preservar", "Amazônia"),
        ("q_sus_funciona", "SUS"), ("q_fake_news_problema", "FakeNews"),
        ("tema_aborto", "Aborto"), ("tema_armas", "Armas"),
        ("tema_privatizacoes", "Privat"), ("recebe_beneficio", "Benefício"),
    ]:
        v = p.get(field)
        if v and v != "Não respondeu" and v != "":
            extras.append(f"{label}:{v}")

    # Confiança institucional
    conf = []
    for field, label in [
        ("q_confianca_stf", "STF"), ("q_confianca_congresso", "Cong"),
        ("q_confianca_imprensa", "Imp"), ("q_confianca_exercito", "Ex"),
        ("q_confianca_igreja", "Igr"),
    ]:
        v = p.get(field)
        if v is not None:
            conf.append(f"{label}:{v}")
    if conf:
        extras.append(f"Conf[{','.join(conf)}]")

    line = " | ".join(parts)
    if extras:
        line += " | " + " ".join(extras)

    return line


async def process_batch(
    client: anthropic.AsyncAnthropic,
    personas: list[dict],
    semaphore: asyncio.Semaphore,
    batch_num: int,
) -> list[dict]:
    """Processa um batch de personas via Claude Haiku."""
    lines = []
    for i, p in enumerate(personas):
        lines.append(summarize_persona(p, i + 1))

    prompt = f"""Para cada eleitor abaixo, determine o sentimento (-1.0 a +1.0) em relação a CADA candidato.
Baseie-se EXCLUSIVAMENTE no perfil: ideologia, voto passado, religião, região, classe, opiniões temáticas.

ELEITORES:
{chr(10).join(lines)}

JSON: [{{"id": 1, "lula": 0.5, "flavio": -0.3, "tarcisio": -0.2, "michelle": -0.4, "zema": 0.0, "caiado": 0.0, "ratinho": 0.0, "haddad": 0.4, "eduardo_leite": 0.0}}]"""

    async with semaphore:
        for attempt in range(3):
            try:
                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=4000,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )

                text = next((b.text for b in response.content if b.type == "text"), "")
                text = text.strip()
                if text.startswith("```"):
                    text = re.sub(r"^```json?\n?", "", text)
                    text = re.sub(r"\n?```$", "", text)

                parsed = json.loads(text)

                results = []
                for i, item in enumerate(parsed):
                    if i >= len(personas):
                        break
                    pid = str(personas[i]["id"])
                    sentiments = {}
                    for cid in CANDIDATE_IDS:
                        val = item.get(cid, 0.0)
                        sentiments[cid] = max(-1.0, min(1.0, float(val)))
                    results.append({"persona_id": pid, "sentiments": sentiments})

                # Fill missing
                for i in range(len(results), len(personas)):
                    pid = str(personas[i]["id"])
                    results.append({"persona_id": pid, "sentiments": {c: 0.0 for c in CANDIDATE_IDS}})

                return results

            except json.JSONDecodeError:
                if attempt < 2:
                    print(f"  [Batch {batch_num}] JSON error, retry {attempt+1}/2...")
                    await asyncio.sleep(2)
                    continue
                # Fallback: use score-based
                return _fallback_batch(personas)

            except Exception as e:
                if "rate" in str(e).lower() or "429" in str(e):
                    wait = (attempt + 1) * 5
                    print(f"  [Batch {batch_num}] Rate limit, wait {wait}s...")
                    await asyncio.sleep(wait)
                    continue
                if attempt < 2:
                    await asyncio.sleep(2)
                    continue
                print(f"  [Batch {batch_num}] Error: {e}")
                return _fallback_batch(personas)

    return _fallback_batch(personas)


def _fallback_batch(personas: list[dict]) -> list[dict]:
    """Fallback se IA falhar — usa scores simples."""
    results = []
    for p in personas:
        eco = float(p.get("score_economico") or 0)
        cost = float(p.get("score_costumes") or 0)
        results.append({
            "persona_id": str(p["id"]),
            "sentiments": {
                "lula": max(-1, min(1, -eco * 0.4)),
                "flavio": max(-1, min(1, (eco + cost) * 0.3)),
                "tarcisio": max(-1, min(1, eco * 0.25)),
                "michelle": max(-1, min(1, (eco + cost) * 0.25)),
                "zema": max(-1, min(1, eco * 0.2)),
                "caiado": max(-1, min(1, eco * 0.15)),
                "ratinho": max(-1, min(1, eco * 0.1)),
                "haddad": max(-1, min(1, -eco * 0.3)),
                "eduardo_leite": max(-1, min(1, eco * 0.05)),
            },
        })
    return results


async def main():
    parser = argparse.ArgumentParser(description="Calibração com IA persona-a-persona")
    parser.add_argument("--sample", type=int, default=0, help="Processar apenas N personas")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)

    # 1. Carregar personas (via SQL direto — REST API muito lenta para 20K com muitos campos)
    print("[AI Calibração] Carregando personas...", flush=True)
    import httpx
    MGMT_TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN", "sbp_180b10149f4be12a9814b00e92887d0d1a2abb4f")
    PROJECT_REF = SUPABASE_URL.split("//")[1].split(".")[0] if "//" in SUPABASE_URL else "sobfplitrzgggzqsycew"

    sql_query = f"SELECT {PERSONA_FIELDS} FROM personas"
    resp_raw = httpx.post(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        headers={"Authorization": f"Bearer {MGMT_TOKEN}", "Content-Type": "application/json"},
        json={"query": sql_query},
        timeout=120.0,
    )
    all_personas = resp_raw.json()
    if isinstance(all_personas, dict) and "message" in all_personas:
        print(f"[AI Calibração] Erro SQL: {all_personas['message']}")
        return

    print(f"[AI Calibração] {len(all_personas)} personas carregadas", flush=True)

    if args.sample > 0:
        import random
        all_personas = random.sample(all_personas, min(args.sample, len(all_personas)))
        print(f"[AI Calibração] Usando sample de {len(all_personas)}")

    # 2. Processar em batches
    batches = [all_personas[i:i + args.batch_size] for i in range(0, len(all_personas), args.batch_size)]
    semaphore = asyncio.Semaphore(MAX_PARALLEL)

    print(f"[AI Calibração] {len(batches)} batches de {args.batch_size} personas")
    print(f"[AI Calibração] Modelo: {MODEL} | Paralelo: {MAX_PARALLEL}")

    all_results: list[dict] = []
    processed = 0
    start_time = time.time()

    tasks = [process_batch(client, batch, semaphore, i + 1) for i, batch in enumerate(batches)]

    for coro in asyncio.as_completed(tasks):
        batch_results = await coro
        all_results.extend(batch_results)
        processed += len(batch_results)

        if processed % 500 == 0 or processed == len(all_personas):
            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            remaining = (len(all_personas) - processed) / rate if rate > 0 else 0
            print(f"  {processed:,}/{len(all_personas):,} ({rate:.0f}/s, ~{remaining:.0f}s restante)")

    elapsed = time.time() - start_time
    print(f"\n[AI Calibração] {len(all_results):,} personas processadas em {elapsed:.0f}s")

    # 3. Estatísticas
    stats: dict[str, dict] = {c: {"sum": 0.0, "pos": 0, "neg": 0, "neu": 0, "total": 0} for c in CANDIDATE_IDS}

    for r in all_results:
        for cid in CANDIDATE_IDS:
            val = r["sentiments"].get(cid, 0.0)
            stats[cid]["total"] += 1
            stats[cid]["sum"] += val
            if val > 0.05:
                stats[cid]["pos"] += 1
            elif val < -0.05:
                stats[cid]["neg"] += 1
            else:
                stats[cid]["neu"] += 1

    print("\n" + "=" * 60)
    print("DISTRIBUIÇÃO DE SENTIMENTOS (IA)")
    print("=" * 60)
    for cid in CANDIDATE_IDS:
        s = stats[cid]
        valid = s["pos"] + s["neg"]
        pct_pos = s["pos"] / valid * 100 if valid > 0 else 0
        avg = s["sum"] / s["total"] if s["total"] > 0 else 0
        print(f"  {cid:15} Pos:{s['pos']:5} ({pct_pos:.1f}%) Neg:{s['neg']:5} Neu:{s['neu']:4} Avg:{avg:+.3f}")

    # Simular 2o turno
    lula_votes = sum(1 for r in all_results if r["sentiments"].get("lula", 0) > r["sentiments"].get("flavio", 0) and r["sentiments"].get("lula", 0) > 0.02)
    flavio_votes = sum(1 for r in all_results if r["sentiments"].get("flavio", 0) > r["sentiments"].get("lula", 0) and r["sentiments"].get("flavio", 0) > 0.02)
    total_2t = lula_votes + flavio_votes
    print(f"\n  2o Turno: Lula {lula_votes} ({lula_votes/total_2t*100:.1f}%) vs Flávio {flavio_votes} ({flavio_votes/total_2t*100:.1f}%)")
    print(f"  Meta: Lula 46.6% / Flávio 47.6%")

    # 4. Salvar
    if args.dry_run:
        print(f"\n[DRY RUN] {len(all_results) * len(CANDIDATE_IDS):,} sentimentos NÃO salvos.")
        return

    print(f"\n[AI Calibração] Salvando {len(all_results) * len(CANDIDATE_IDS):,} sentimentos...")

    # Limpar existentes
    sb.table("persona_sentiments").delete().neq("persona_id", "00000000-0000-0000-0000-000000000000").execute()

    # Inserir em batches
    rows = []
    for r in all_results:
        for cid in CANDIDATE_IDS:
            val = round(r["sentiments"].get(cid, 0.0), 4)
            rows.append({
                "persona_id": r["persona_id"],
                "candidate_id": cid,
                "sentiment": val,
                "initial_sentiment": val,
            })

    insert_batch = 500
    for i in range(0, len(rows), insert_batch):
        batch = rows[i:i + insert_batch]
        sb.table("persona_sentiments").upsert(batch).execute()
        if (i + insert_batch) % 10000 == 0 or i + insert_batch >= len(rows):
            print(f"  {min(i + insert_batch, len(rows)):,}/{len(rows):,}")

    # Recomputar polling
    result = sb.rpc("compute_polling").execute()
    print(f"\n[AI Calibração] Polling: {result.data}")
    print(f"[AI Calibração] Completo!")


if __name__ == "__main__":
    asyncio.run(main())
