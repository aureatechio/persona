"""
Rebalancear Personas — ajustar perfis ideológicos para refletir o Brasil real.

O banco tem 54% esquerda vs 42% direita.
O Brasil real (Atlas/Bloomberg mar/2026): ~48% direita vs ~47% esquerda.

Precisamos mover ~1.200 personas de Centro-Esquerda/Esquerda moderada
para Centro/Centro-Direita, ajustando scores E opiniões para coerência.

Uso:
  python rebalance_personas.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env.local"
load_dotenv(_env_file) if _env_file.exists() else load_dotenv(_project_root / ".env")

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

# Quantas personas mover
TARGET_MOVE = 1200

# Campos q_* que devem mudar quando alguém se torna mais conservador
# Formato: (campo, valor_esquerda_tipico, valor_direita_tipico, probabilidade_de_mudar)
OPINION_SHIFTS = [
    ("q_corrupcao_problema", None, "Sim", 0.7),  # insatisfação com corrupção do governo
    ("q_estado_tamanho", "Maior", "Menor", 0.4),
    ("q_imposto_ricos", "Sim", "Não", 0.3),
    ("q_reforma_tributaria", "Sim", "Não", 0.25),
    ("q_intervencao_militar", "Não", "Sim", 0.15),
    ("q_seguranca_prioridade", None, "Sim", 0.5),
    ("q_familia_tradicional", "Não", "Sim", 0.35),
    ("q_meritocracia", "Não", "Sim", 0.4),
    ("q_avaliacao_bolsonaro", "Ruim", "Regular", 0.3),  # não vira fã, mas ameniza
    ("aprovacao_lula", "Aprova", "Desaprova", 0.6),  # descontente com governo
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Buscar candidatos a rebalancear:
    #    - Centro-Esquerda com scores moderados (mais fácil de mover)
    #    - Moderados (M) que estão classificados como esquerda
    #    - Priorizar quem tem scores próximos de 0 (swing voters naturais)
    print("[Rebalance] Buscando personas elegíveis...")

    # IMPORTANTE: Só mover personas de Sul, Sudeste, Centro-Oeste
    # Nordeste e Norte são base Lula — NÃO MEXER na ideologia deles
    fields = "id,cluster_id,score_economico,score_costumes,political_leaning,aprovacao_lula,q_avaliacao_bolsonaro,q_corrupcao_problema,q_estado_tamanho,q_imposto_ricos,q_seguranca_prioridade,q_familia_tradicional,q_meritocracia,q_intervencao_militar,q_reforma_tributaria,voto_2022,region_br,state"

    eligible: list[dict] = []
    REGIOES_ALVO = ["Sul", "Sudeste", "Centro-Oeste"]

    for region in REGIOES_ALVO:
        # Centro-Esquerda e Esquerda moderada dessas regiões
        resp = sb.table("personas").select(fields) \
            .in_("political_leaning", ["Centro-Esquerda", "Esquerda"]) \
            .eq("region_br", region) \
            .gte("score_economico", -0.6) \
            .execute()
        if resp.data:
            eligible.extend(resp.data)

        # Centro inclinados à esquerda dessas regiões
        resp2 = sb.table("personas").select(fields) \
            .eq("political_leaning", "Centro") \
            .eq("region_br", region) \
            .lt("score_economico", 0) \
            .execute()
        if resp2.data:
            eligible.extend(resp2.data)

    print(f"[Rebalance] {len(eligible)} personas elegíveis (só Sul/Sudeste/CO — Nordeste/Norte preservados)")

    # Ordenar por "proximidade ao centro" — mais fáceis de mover primeiro
    eligible.sort(key=lambda p: abs(float(p.get("score_economico") or 0)) + abs(float(p.get("score_costumes") or 0)))

    # Selecionar as TARGET_MOVE mais próximas do centro
    to_move = eligible[:TARGET_MOVE]
    print(f"[Rebalance] Selecionadas {len(to_move)} para rebalancear")

    # 2. Calcular novos valores para cada persona
    updates = []
    stats = {"moved": 0, "opinions_changed": 0}

    for p in to_move:
        pid = p["id"]
        old_eco = float(p.get("score_economico") or 0)
        old_cost = float(p.get("score_costumes") or 0)

        # Mover scores para direita/centro
        # Shift proporcional: quem está mais perto de 0 move menos
        eco_shift = random.uniform(0.15, 0.35)
        cost_shift = random.uniform(0.05, 0.2)

        new_eco = min(1.0, old_eco + eco_shift)
        new_cost = min(1.0, old_cost + cost_shift)

        update = {
            "id": pid,
            "score_economico": round(new_eco, 4),
            "score_costumes": round(new_cost, 4),
        }

        # Determinar novo political_leaning
        avg = (new_eco + new_cost) / 2
        if avg < -0.15:
            update["political_leaning"] = "Centro-Esquerda"
        elif avg < 0.15:
            update["political_leaning"] = "Centro"
        elif avg < 0.5:
            update["political_leaning"] = "Centro-Direita"
        else:
            update["political_leaning"] = "Direita"

        # Mudar opiniões para coerência
        opinion_updates = {}
        for field, val_esq, val_dir, prob in OPINION_SHIFTS:
            if random.random() < prob:
                current = p.get(field)
                # Só muda se tem valor de esquerda ou está vazio
                if val_esq and current and val_esq.lower() in str(current).lower():
                    opinion_updates[field] = val_dir
                    stats["opinions_changed"] += 1
                elif not current or current == "Não respondeu":
                    opinion_updates[field] = val_dir
                    stats["opinions_changed"] += 1

        update.update(opinion_updates)

        # Se estava como "Lula" em voto_2022, alguns mudam para indeciso/branco
        voto22 = str(p.get("voto_2022") or "").lower()
        if "lula" in voto22 and random.random() < 0.3:
            update["voto_2022"] = "Branco/Nulo"

        updates.append(update)
        stats["moved"] += 1

    # 3. Mostrar estatísticas
    print(f"\n{'='*60}")
    print("REBALANCEAMENTO")
    print(f"{'='*60}")
    print(f"  Personas movidas: {stats['moved']}")
    print(f"  Opiniões ajustadas: {stats['opinions_changed']}")

    # Contar novas leanings
    new_leanings: dict[str, int] = {}
    for u in updates:
        l = u.get("political_leaning", "?")
        new_leanings[l] = new_leanings.get(l, 0) + 1
    print(f"\n  Novas classificações:")
    for l, c in sorted(new_leanings.items(), key=lambda x: -x[1]):
        print(f"    {l}: {c}")

    if args.dry_run:
        print(f"\n[DRY RUN] Nada foi salvo.")
        return

    # 4. Aplicar
    print(f"\n[Rebalance] Aplicando {len(updates)} atualizações...")

    batch_size = 100
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        for update in batch:
            pid = update.pop("id")
            sb.table("personas").update(update).eq("id", pid).execute()
            update["id"] = pid  # restaurar

        done = min(i + batch_size, len(updates))
        if done % 500 == 0 or done == len(updates):
            print(f"  {done}/{len(updates)}")

    # 5. Re-derivar political_leaning via RPC para todos
    print("[Rebalance] Re-derivando political_leaning...")
    sb.rpc("rederive_political_leaning").execute()

    # Verificar nova distribuição
    resp = sb.table("personas").select("political_leaning").execute()
    dist: dict[str, int] = {}
    for r in resp.data:
        l = r.get("political_leaning", "?")
        dist[l] = dist.get(l, 0) + 1

    print(f"\n  Nova distribuição:")
    total = sum(dist.values())
    esq = sum(v for k, v in dist.items() if "esquerda" in k.lower() or "extrema esquerda" in k.lower())
    dir_ = sum(v for k, v in dist.items() if "direita" in k.lower() or "extrema direita" in k.lower())
    cen = dist.get("Centro", 0)
    for l, c in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"    {l:25} {c:5} ({c/total*100:.1f}%)")
    print(f"\n  Esquerda total: {esq} ({esq/total*100:.1f}%)")
    print(f"  Direita total: {dir_} ({dir_/total*100:.1f}%)")
    print(f"  Centro: {cen} ({cen/total*100:.1f}%)")

    print(f"\n[Rebalance] Completo! Agora rode calibrate_with_ai.py para recalibrar sentimentos.")


if __name__ == "__main__":
    main()
