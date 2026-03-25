"""
Rebalancear Personas com IA — ajusta TODOS os campos de forma coerente.

Quando uma persona muda de Centro-Esquerda para Centro-Direita, a IA atualiza:
- score_economico, score_costumes
- voto_2022, voto_2026, aprovacao_lula
- q_avaliacao_bolsonaro, q_politico_favorito
- TODOS os q_* (80+ campos) para coerência total
- archetype_primary

Isso garante que a persona inteira faz sentido — análises futuras serão fidedignas.

Uso:
  python rebalance_with_ai.py [--sample N] [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import time
from pathlib import Path

import anthropic
from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env.local"
load_dotenv(_env_file) if _env_file.exists() else load_dotenv(_project_root / ".env")

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

MODEL = "claude-haiku-4-5-20251001"
MAX_PARALLEL = 8
BATCH_SIZE = 5  # Menor porque cada persona gera muitos campos

TARGET_MOVE = 1200
REGIOES_ALVO = ["Sul", "Sudeste", "Centro-Oeste"]

# Campos essenciais para rebalancear (sem duplicados, só campos que existem)
ALL_FIELDS = ",".join([
    "id", "name", "age", "gender",
    "education_level", "generation", "political_leaning",
    "macro_religion", "archetype_primary",
    "cluster_id", "nome_grupo", "score_economico", "score_costumes",
    "social_class", "area_type", "region_br", "state",
    "raca_cor", "recebe_beneficio",
    "voto_2022", "aprovacao_lula", "voto_2026",
    "q_avaliacao_bolsonaro", "q_politico_favorito",
    "q_corrupcao_problema", "q_bolsa_familia_bom",
    "q_auxilio_emergencial_voltar", "q_estado_tamanho",
    "q_imposto_ricos", "q_intervencao_militar",
    "q_democracia_importante", "q_reforma_tributaria",
    "q_seguranca_prioridade", "q_familia_tradicional",
    "q_racismo_estrutural", "q_meritocracia",
    "q_religiao_politica", "q_feminismo_bom",
    "q_fake_news_problema",
    "tema_aborto", "tema_armas", "tema_privatizacoes",
])

# Campos que a IA deve atualizar (os que refletem posição política)
UPDATABLE_FIELDS = [
    "score_economico", "score_costumes", "political_leaning",
    "voto_2022", "voto_2026", "aprovacao_lula",
    "q_avaliacao_bolsonaro", "q_politico_favorito",
    "q_corrupcao_problema", "q_bolsa_familia_bom",
    "q_auxilio_emergencial_voltar", "q_estado_tamanho",
    "q_imposto_ricos", "q_intervencao_militar",
    "q_democracia_importante", "q_reforma_tributaria",
    "q_seguranca_prioridade", "q_familia_tradicional",
    "q_pena_morte", "q_racismo_estrutural", "q_meritocracia",
    "q_religiao_politica", "q_feminismo_bom",
    "q_mudanca_climatica_real", "q_amazonia_preservar",
    "q_fake_news_problema", "q_sus_funciona",
    "q_universidade_publica_gratuita", "q_direitos_lgbt",
    "q_confianca_stf", "q_confianca_congresso",
    "q_confianca_imprensa", "q_confianca_exercito", "q_confianca_igreja",
    "tema_aborto", "tema_armas", "tema_maconha", "tema_privatizacoes",
    "tema_cotas_raciais", "tema_casamento_gay",
    "q_bolsonaro_ditador", "q_pt_comunista",
    "q_impeachment_lula", "q_sistema_eleitoral_confiavel",
    "q_policia_violenta", "q_prisao_perpetua", "q_maioridade_penal_16",
    "q_salario_minimo_aumentar", "q_teto_gastos",
    "q_previdencia_reforma", "q_situacao_economica",
    "q_perspectiva_futuro", "q_maior_problema",
]

SYSTEM_PROMPT = """Você é um especialista em comportamento eleitoral brasileiro. Atualize o perfil político de eleitores que estão migrando para o centro/centro-direita.

REGRAS:
- NÃO virou extremista — é moderado insatisfeito com governo
- Coerência com região, escolaridade, religião, classe
- score_economico: subir para 0.1-0.5 (centro) ou 0.3-0.7 (centro-direita)
- political_leaning: "Centro" ou "Centro-Direita"
- aprovacao_lula: "Desaprova" ou "Neutro"
- voto_2022: manter ou virar "Branco/Nulo"
- NÃO mude nome, idade, gênero, estado, religião

Responda APENAS JSON. Para cada persona, retorne SOMENTE os campos que mudam:
[{"id":1,"score_economico":0.3,"score_costumes":0.1,"political_leaning":"Centro-Direita","aprovacao_lula":"Desaprova","q_avaliacao_bolsonaro":"Regular","q_corrupcao_problema":"Sim","q_familia_tradicional":"Sim","q_seguranca_prioridade":"Sim","q_estado_tamanho":"Menor","q_meritocracia":"Sim"}]"""


def summarize_persona(p: dict, idx: int) -> str:
    """Resumo completo do perfil atual."""
    parts = [
        f'[{idx}] {p.get("name","?")} | {p.get("gender","?")}, {p.get("age","?")}a, {p.get("raca_cor","?")}',
        f'{p.get("state","?")} ({p.get("region_br","?")}, {p.get("area_type","?")})',
        f'Esc:{p.get("education_level","?")} | Classe:{p.get("social_class","?")}',
        f'Rel:{p.get("macro_religion","")} | Arq:{p.get("archetype_primary","")}',
        f'Cluster:{p.get("cluster_id","")}({p.get("nome_grupo","")})',
        f'ScoreEco:{p.get("score_economico",0):.3f} | ScoreCost:{p.get("score_costumes",0):.3f}',
        f'Pol:{p.get("political_leaning","")}',
        f'Voto22:{p.get("voto_2022","")} | AprovLula:{p.get("aprovacao_lula","")} | Voto26:{p.get("voto_2026","")}',
        f'AvalBolso:{p.get("q_avaliacao_bolsonaro","")} | Favorito:{p.get("q_politico_favorito","")}',
    ]

    # Opiniões atuais
    opinions = []
    for field in ["q_corrupcao_problema", "q_bolsa_familia_bom", "q_estado_tamanho",
                   "q_imposto_ricos", "q_intervencao_militar", "q_familia_tradicional",
                   "q_seguranca_prioridade", "q_meritocracia", "q_religiao_politica",
                   "tema_aborto", "tema_armas", "tema_privatizacoes"]:
        v = p.get(field)
        if v and v != "Não respondeu":
            label = field.replace("q_", "").replace("tema_", "")
            opinions.append(f"{label}:{v}")

    if opinions:
        parts.append(" ".join(opinions))

    return " | ".join(parts)


async def process_batch(
    client: anthropic.AsyncAnthropic,
    personas: list[dict],
    semaphore: asyncio.Semaphore,
    batch_num: int,
) -> list[dict]:
    """Processa batch — IA atualiza TODOS os campos de forma coerente."""
    lines = [summarize_persona(p, i + 1) for i, p in enumerate(personas)]

    prompt = f"""Atualize o perfil político de cada pessoa abaixo. Elas estão migrando de Centro-Esquerda/Esquerda para Centro ou Centro-Direita (insatisfação com governo Lula).

Considere a região, escolaridade, religião e classe social de CADA uma para decidir A INTENSIDADE da mudança.

PERSONAS:
{chr(10).join(lines)}

Retorne JSON com TODOS os campos atualizados para cada persona. Campos que NÃO mudam (nome, idade, estado) NÃO inclua."""

    async with semaphore:
        for attempt in range(3):
            try:
                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=8000,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.4,
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
                    update = {"id": pid}

                    # Só pegar campos permitidos
                    for field in UPDATABLE_FIELDS:
                        if field in item:
                            val = item[field]
                            if field in ("score_economico", "score_costumes"):
                                val = max(-1.0, min(1.0, float(val)))
                                val = round(val, 4)
                            elif field.startswith("q_confianca"):
                                val = max(1, min(10, int(val)))
                            update[field] = val

                    results.append(update)

                return results

            except json.JSONDecodeError:
                if attempt < 2:
                    print(f"  [Batch {batch_num}] JSON error, retry...")
                    await asyncio.sleep(2)
                    continue
                return []
            except Exception as e:
                if "rate" in str(e).lower() or "429" in str(e):
                    await asyncio.sleep((attempt + 1) * 5)
                    continue
                print(f"  [Batch {batch_num}] Error: {e}")
                return []

    return []


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)

    # 1. Buscar personas elegíveis (Sul/Sudeste/CO, Centro-Esquerda/Esquerda moderada)
    print("[Rebalance IA] Buscando personas elegíveis...")
    eligible: list[dict] = []

    for region in REGIOES_ALVO:
        resp = sb.table("personas").select(ALL_FIELDS) \
            .in_("political_leaning", ["Centro-Esquerda", "Esquerda"]) \
            .eq("region_br", region) \
            .gte("score_economico", -0.6) \
            .execute()
        if resp.data:
            eligible.extend(resp.data)

        resp2 = sb.table("personas").select(ALL_FIELDS) \
            .eq("political_leaning", "Centro") \
            .eq("region_br", region) \
            .lt("score_economico", 0) \
            .execute()
        if resp2.data:
            eligible.extend(resp2.data)

    print(f"[Rebalance IA] {len(eligible)} elegíveis (Sul/Sudeste/CO)")

    # Ordenar por proximidade ao centro
    eligible.sort(key=lambda p: abs(float(p.get("score_economico") or 0)) + abs(float(p.get("score_costumes") or 0)))

    to_move = eligible[:TARGET_MOVE]
    if args.sample > 0:
        to_move = to_move[:args.sample]

    print(f"[Rebalance IA] {len(to_move)} personas para processar")

    # 2. Processar com IA
    batches = [to_move[i:i + BATCH_SIZE] for i in range(0, len(to_move), BATCH_SIZE)]
    semaphore = asyncio.Semaphore(MAX_PARALLEL)

    print(f"[Rebalance IA] {len(batches)} batches de {BATCH_SIZE} | Modelo: {MODEL}")

    all_updates: list[dict] = []
    processed = 0
    start = time.time()

    tasks = [process_batch(client, batch, semaphore, i + 1) for i, batch in enumerate(batches)]

    for coro in asyncio.as_completed(tasks):
        results = await coro
        all_updates.extend(results)
        processed += BATCH_SIZE

        if processed % 100 == 0 or processed >= len(to_move):
            elapsed = time.time() - start
            rate = len(all_updates) / elapsed if elapsed > 0 else 0
            print(f"  {len(all_updates)}/{len(to_move)} ({rate:.1f}/s)")

    elapsed = time.time() - start
    print(f"\n[Rebalance IA] {len(all_updates)} personas processadas em {elapsed:.0f}s")

    # 3. Estatísticas
    new_leanings: dict[str, int] = {}
    fields_changed = 0
    for u in all_updates:
        l = u.get("political_leaning", "?")
        new_leanings[l] = new_leanings.get(l, 0) + 1
        fields_changed += len(u) - 1  # minus id

    print(f"\n{'='*60}")
    print("RESULTADO DO REBALANCEAMENTO COM IA")
    print(f"{'='*60}")
    print(f"  Personas atualizadas: {len(all_updates)}")
    print(f"  Campos modificados: {fields_changed}")
    print(f"\n  Novas classificações:")
    for l, c in sorted(new_leanings.items(), key=lambda x: -x[1]):
        print(f"    {l}: {c}")

    if args.dry_run:
        print(f"\n[DRY RUN] Nada salvo.")
        # Mostrar exemplo
        if all_updates:
            print(f"\n  Exemplo de atualização:")
            example = all_updates[0]
            for k, v in list(example.items())[:15]:
                print(f"    {k}: {v}")
        return

    # 4. Aplicar
    print(f"\n[Rebalance IA] Aplicando {len(all_updates)} atualizações...")
    for i, update in enumerate(all_updates):
        pid = update.pop("id")
        try:
            sb.table("personas").update(update).eq("id", pid).execute()
        except Exception as e:
            print(f"  Erro persona {pid}: {e}")
        update["id"] = pid

        if (i + 1) % 200 == 0 or i + 1 == len(all_updates):
            print(f"  {i + 1}/{len(all_updates)}")

    print(f"\n[Rebalance IA] Completo!")
    print(f"Próximo passo: python calibrate_with_ai.py (recalibrar sentimentos)")


if __name__ == "__main__":
    asyncio.run(main())
