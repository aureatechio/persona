"""
Calibração Inicial — Personas Vivas

Deriva sentimentos por candidato a partir dos campos existentes de cada persona.
Popula a tabela persona_sentiments com valores iniciais calibrados.

Uso:
  cd scripts
  python calibrate_living_personas.py [--dry-run] [--sample N]
"""
from __future__ import annotations

import argparse
import math
import os
import random
import sys
import time
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env
_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env.local"
if _env_file.exists():
    load_dotenv(_env_file)
else:
    load_dotenv(_project_root / ".env")

from supabase import create_client


# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://sobfplitrzgggzqsycew.supabase.co",
)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY", ""
)

# Campos necessários para calibração
CALIBRATION_FIELDS = ",".join([
    "id", "cluster_id", "nome_grupo",
    "score_economico", "score_costumes",
    "political_leaning", "archetype_primary",
    "voto_2022", "aprovacao_lula", "voto_2026",
    "q_avaliacao_bolsonaro", "q_politico_favorito",
    "q_corrupcao_problema", "q_bolsa_familia_bom",
    "q_auxilio_emergencial_voltar", "q_estado_tamanho",
    "q_imposto_ricos", "q_intervencao_militar",
    "q_democracia_importante", "q_reforma_tributaria",
    "q_seguranca_prioridade", "q_mudanca_climatica_real",
    "q_amazonia_preservar", "q_familia_tradicional",
    "tema_casamento_gay", "q_aborto_estupro",
    "macro_religion", "religiao_subtipo",
    "social_class", "education_level",
    "region_br", "area_type", "state", "generation",
    "recebe_beneficio", "age",
])

# Candidatos e seus perfis (todos da pesquisa Atlas/Bloomberg mar/2026)
CANDIDATES = {
    "lula": {"leaning": "esquerda", "party": "PT"},
    "flavio": {"leaning": "direita", "party": "PL"},
    "tarcisio": {"leaning": "direita", "party": "Republicanos"},
    "zema": {"leaning": "direita", "party": "Novo"},
    "michelle": {"leaning": "direita", "party": "PL"},
    "caiado": {"leaning": "direita", "party": "PSD"},
    "ratinho": {"leaning": "centro-direita", "party": "PSD"},
    "haddad": {"leaning": "esquerda", "party": "PT"},
    "eduardo_leite": {"leaning": "centro-direita", "party": "PSD"},
}

# Metas de 2o turno vs Lula (pesquisa Atlas/Bloomberg 25/03/2026)
POLLING_TARGETS_2T = {
    "flavio": 47.6,
    "michelle": 47.0,
    "tarcisio": 47.2,
    "zema": 43.7,
    "caiado": 36.7,
    "ratinho": 38.7,
    "eduardo_leite": 22.7,
    "lula": 46.6,  # avg contra todos
    "haddad": 37.6,  # 1o turno sem Lula
}


# ── Funções de sentimento ─────────────────────────────────────────────────────

def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _is_positive(value) -> bool:
    """Checa se uma resposta de questionário é positiva."""
    if value is None:
        return False
    s = str(value).lower().strip()
    return s in ("sim", "a favor", "aprova", "bom", "ótimo", "otimo", "excelente", "muito bom", "concordo")


def _is_negative(value) -> bool:
    s = str(value).lower().strip()
    return s in ("não", "nao", "contra", "desaprova", "ruim", "péssimo", "pessimo", "muito ruim", "discordo")


def derive_sentiment_lula(p: dict) -> float:
    """Deriva sentimento por Lula a partir do perfil da persona."""
    eco = float(p.get("score_economico") or 0)
    cost = float(p.get("score_costumes") or 0)

    # Base: score econômico negativo = tende a Lula
    # Nota: banco tem mais P (8735) que C (8075) e M com avg_eco=-0.47
    # Banco tem viés estrutural de esquerda — reduzir força do Lula
    base = -eco * 0.15

    # Aprovação Lula (campo direto)
    aprov = str(p.get("aprovacao_lula") or "").lower()
    if "aprova" in aprov and "desaprova" not in aprov:
        base += 0.15
    elif "desaprova" in aprov:
        base -= 0.35

    # Voto 2022
    voto22 = str(p.get("voto_2022") or "").lower()
    if "lula" in voto22:
        base += 0.2
    elif "bolsonaro" in voto22:
        base -= 0.2

    # Voto 2026 (se declarado)
    voto26 = str(p.get("voto_2026") or "").lower()
    if "lula" in voto26:
        base += 0.1
    elif voto26 and "lula" not in voto26 and voto26 not in ("", "indeciso", "nulo", "branco"):
        base -= 0.05

    # Político favorito
    favorito = str(p.get("q_politico_favorito") or "").lower()
    if "lula" in favorito:
        base += 0.1
    elif "bolsonaro" in favorito:
        base -= 0.1

    # Questões temáticas pró-esquerda (reduzido)
    if _is_positive(p.get("q_bolsa_familia_bom")):
        base += 0.03
    if _is_positive(p.get("q_auxilio_emergencial_voltar")):
        base += 0.03
    if _is_positive(p.get("q_imposto_ricos")):
        base += 0.02

    # Costumes conservadores penalizam Lula
    if cost > 0.3:
        base -= 0.08
    if _is_positive(p.get("q_familia_tradicional")):
        base -= 0.04
    if _is_positive(p.get("q_intervencao_militar")):
        base -= 0.06

    # Região (Nordeste tende a Lula)
    if p.get("region_br") == "Nordeste":
        base += 0.04
    elif p.get("region_br") in ("Sul", "Centro-Oeste"):
        base -= 0.04

    # Banco: P=8735, C=8075, M=2887(esquerda), T=303
    # Efetivo: ~11600 esquerda vs ~8000 direita — viés massivo
    # Para chegar em 46% Lula, P precisa ter muitos negativos internos
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("P"):
        base -= 0.1  # progressistas: parcela insatisfeita com governo Lula
    elif cluster.startswith("C"):
        base -= 0.3  # C fortemente anti-Lula
    elif cluster.startswith("M"):
        base -= 0.22  # M swing — pesquisas mostram Flávio liderando entre moderados
    elif cluster == "T1":
        base *= 0.15
    elif cluster == "T2":
        base -= 0.15  # anti-incumbente = contra Lula (presidente)

    # Ruído
    base += random.uniform(-0.04, 0.04)

    return clamp(base)


def derive_sentiment_flavio(p: dict) -> float:
    """Deriva sentimento por Flávio Bolsonaro."""
    eco = float(p.get("score_economico") or 0)
    cost = float(p.get("score_costumes") or 0)

    # Base: scores positivos = tende a Flávio (aumentado para equilibrar)
    base = (eco * 0.35 + cost * 0.3)

    # Avaliação Bolsonaro (campo direto, forte)
    aval = str(p.get("q_avaliacao_bolsonaro") or "").lower()
    if aval in ("bom", "ótimo", "otimo", "excelente", "muito bom"):
        base += 0.35
    elif aval in ("ruim", "péssimo", "pessimo", "muito ruim"):
        base -= 0.25

    # Voto 2022
    voto22 = str(p.get("voto_2022") or "").lower()
    if "bolsonaro" in voto22:
        base += 0.25
    elif "lula" in voto22:
        base -= 0.15

    # Voto 2026
    voto26 = str(p.get("voto_2026") or "").lower()
    if "flavio" in voto26 or "bolsonaro" in voto26:
        base += 0.15

    # Político favorito
    favorito = str(p.get("q_politico_favorito") or "").lower()
    if "bolsonaro" in favorito:
        base += 0.15
    elif "lula" in favorito:
        base -= 0.1

    # Questões temáticas pró-direita (aumentado)
    if _is_positive(p.get("q_familia_tradicional")):
        base += 0.05
    if _is_positive(p.get("q_seguranca_prioridade")):
        base += 0.04
    if _is_positive(p.get("q_intervencao_militar")):
        base += 0.06
    if p.get("q_estado_tamanho") and "menor" in str(p["q_estado_tamanho"]).lower():
        base += 0.04

    # Anti-corrupção PT ajuda Flávio
    if _is_positive(p.get("q_corrupcao_problema")):
        base += 0.03

    # Religião evangélica
    religion = str(p.get("macro_religion") or "").lower()
    if "evangel" in religion:
        base += 0.1

    # Região
    if p.get("region_br") in ("Sul", "Centro-Oeste"):
        base += 0.06
    elif p.get("region_br") == "Nordeste":
        base -= 0.03

    # Banco: P=8735, C=8075, M=2887 — C precisa compensar com sentimento alto
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("C"):
        base += 0.2  # forte pró-Flávio
    elif cluster.startswith("P"):
        base -= 0.03
    elif cluster.startswith("M"):
        base += 0.15  # M precisa virar pró-Flávio (pesquisas reais mostram isso)
    elif cluster == "T1":
        base *= 0.2
    elif cluster == "T2":
        base += 0.08  # anti-incumbente = pró-oposição

    base += random.uniform(-0.04, 0.04)
    return clamp(base)


def derive_sentiment_ratinho(p: dict) -> float:
    """Deriva sentimento por Ratinho Jr. (centro-direita, moderado)."""
    eco = float(p.get("score_economico") or 0)
    cost = float(p.get("score_costumes") or 0)

    # Base fraca: centro-direita moderado
    base = eco * 0.15 + cost * 0.05

    # Moderados ganham boost
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("M"):
        base += 0.1
    elif cluster.startswith("T"):
        base += 0.03

    # Paraná/Sul
    if p.get("state") == "PR":
        base += 0.15
    elif p.get("region_br") == "Sul":
        base += 0.05

    # Voto 2026 (se declarou Ratinho)
    voto26 = str(p.get("voto_2026") or "").lower()
    if "ratinho" in voto26:
        base += 0.2

    # Sentimento geralmente mais fraco (menos conhecido)
    base *= 0.7

    base += random.uniform(-0.03, 0.03)
    return clamp(base)


def derive_sentiment_caiado(p: dict) -> float:
    """Deriva sentimento por Caiado (direita, agro, rural)."""
    eco = float(p.get("score_economico") or 0)
    cost = float(p.get("score_costumes") or 0)

    # Base: direita
    base = eco * 0.2 + cost * 0.15

    # Rural/agro
    if p.get("area_type") and "rural" in str(p["area_type"]).lower():
        base += 0.1

    # Goiás/Centro-Oeste
    if p.get("state") == "GO":
        base += 0.15
    elif p.get("region_br") == "Centro-Oeste":
        base += 0.05

    # Conservadores
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("C"):
        base += 0.05

    # Voto 2026
    voto26 = str(p.get("voto_2026") or "").lower()
    if "caiado" in voto26:
        base += 0.2

    # Menos conhecido: sentimento mais fraco
    base *= 0.6

    base += random.uniform(-0.03, 0.03)
    return clamp(base)


def derive_sentiment_tarcisio(p: dict) -> float:
    """Tarcísio de Freitas — direita moderada, gestor, SP."""
    base = derive_sentiment_flavio(p) * 0.85  # similar ao Flávio mas mais suave
    # Bonus SP
    if p.get("state") == "SP":
        base += 0.15
    elif p.get("region_br") == "Sudeste":
        base += 0.05
    # Gestor técnico atrai escolaridade alta
    edu = str(p.get("education_level") or "").lower()
    if "superior" in edu or "pós" in edu or "pos" in edu:
        base += 0.05
    base += random.uniform(-0.03, 0.03)
    return clamp(base * 0.8)  # menos conhecido que Flávio


def derive_sentiment_michelle(p: dict) -> float:
    """Michelle Bolsonaro — direita, evangélica, mulheres."""
    base = derive_sentiment_flavio(p) * 0.9  # herda base do bolsonarismo
    # Bonus evangélica forte
    religion = str(p.get("macro_religion") or "").lower()
    if "evangel" in religion:
        base += 0.1
    # Mulheres
    gender = str(p.get("gender") or "").lower()
    if gender in ("feminino", "f", "mulher"):
        base += 0.05
    base += random.uniform(-0.03, 0.03)
    return clamp(base * 0.85)


def derive_sentiment_zema(p: dict) -> float:
    """Romeu Zema — direita liberal, Novo, MG."""
    eco = float(p.get("score_economico") or 0)
    base = eco * 0.3  # liberal econômico
    # MG
    if p.get("state") == "MG":
        base += 0.15
    elif p.get("region_br") == "Sudeste":
        base += 0.03
    # Escolaridade alta gosta
    edu = str(p.get("education_level") or "").lower()
    if "superior" in edu or "pós" in edu:
        base += 0.05
    # Liberal de mercado
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("C"):
        base += 0.08
    elif cluster.startswith("M"):
        base += 0.03
    elif cluster.startswith("P"):
        base -= 0.08
    base += random.uniform(-0.03, 0.03)
    return clamp(base * 0.7)  # menos conhecido


def derive_sentiment_haddad(p: dict) -> float:
    """Fernando Haddad — esquerda, PT, São Paulo."""
    base = derive_sentiment_lula(p) * 0.7  # herda base petista mas mais fraco
    # SP
    if p.get("state") == "SP":
        base += 0.05
    # Escolaridade alta
    edu = str(p.get("education_level") or "").lower()
    if "superior" in edu or "pós" in edu:
        base += 0.03
    base += random.uniform(-0.03, 0.03)
    return clamp(base * 0.75)  # sem carisma do Lula


def derive_sentiment_eduardo_leite(p: dict) -> float:
    """Eduardo Leite — centro-direita, RS, moderado."""
    eco = float(p.get("score_economico") or 0)
    base = eco * 0.15  # centro-direita leve
    # RS/Sul
    if p.get("state") == "RS":
        base += 0.12
    elif p.get("region_br") == "Sul":
        base += 0.05
    # Moderados
    cluster = str(p.get("cluster_id") or "")
    if cluster.startswith("M"):
        base += 0.05
    base += random.uniform(-0.03, 0.03)
    return clamp(base * 0.4)  # muito pouco conhecido


# Mapeamento de funções
SENTIMENT_DERIVERS = {
    "lula": derive_sentiment_lula,
    "flavio": derive_sentiment_flavio,
    "tarcisio": derive_sentiment_tarcisio,
    "michelle": derive_sentiment_michelle,
    "zema": derive_sentiment_zema,
    "caiado": derive_sentiment_caiado,
    "ratinho": derive_sentiment_ratinho,
    "haddad": derive_sentiment_haddad,
    "eduardo_leite": derive_sentiment_eduardo_leite,
}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Calibração inicial de personas vivas")
    parser.add_argument("--dry-run", action="store_true", help="Apenas calcula, não salva")
    parser.add_argument("--sample", type=int, default=0, help="Processar apenas N personas (debug)")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Carregar todas as personas
    print("[Calibração] Carregando personas...")
    all_personas: list[dict] = []
    offset = 0
    batch_size = 1000

    while True:
        resp = sb.table("personas").select(CALIBRATION_FIELDS).range(offset, offset + batch_size - 1).execute()
        if resp.data:
            all_personas.extend(resp.data)
            if len(resp.data) < batch_size:
                break
            offset += batch_size
        else:
            break

    total = len(all_personas)
    print(f"[Calibração] {total} personas carregadas")

    if args.sample > 0:
        all_personas = random.sample(all_personas, min(args.sample, total))
        print(f"[Calibração] Usando sample de {len(all_personas)} personas")

    # 2. Calcular sentimentos
    print("[Calibração] Derivando sentimentos...")
    rows_to_insert: list[dict] = []
    stats: dict[str, dict] = {cid: {"positive": 0, "negative": 0, "neutral": 0, "total": 0, "sum": 0.0}
                               for cid in CANDIDATES}

    for persona in all_personas:
        pid = persona["id"]
        for candidate_id, deriver in SENTIMENT_DERIVERS.items():
            sentiment = round(deriver(persona), 4)
            rows_to_insert.append({
                "persona_id": pid,
                "candidate_id": candidate_id,
                "sentiment": sentiment,
                "initial_sentiment": sentiment,
            })

            # Stats
            stats[candidate_id]["total"] += 1
            stats[candidate_id]["sum"] += sentiment
            if sentiment > 0.05:
                stats[candidate_id]["positive"] += 1
            elif sentiment < -0.05:
                stats[candidate_id]["negative"] += 1
            else:
                stats[candidate_id]["neutral"] += 1

    # 3. Mostrar distribuição
    print("\n" + "=" * 70)
    print("DISTRIBUIÇÃO DE SENTIMENTOS (calibração)")
    print("=" * 70)

    for cid, s in stats.items():
        total_voters = s["positive"] + s["negative"]
        pct_positive = (s["positive"] / total_voters * 100) if total_voters > 0 else 0
        pct_negative = (s["negative"] / total_voters * 100) if total_voters > 0 else 0
        avg = s["sum"] / s["total"] if s["total"] > 0 else 0
        print(f"\n  {cid.upper()} ({CANDIDATES[cid]['party']}):")
        print(f"    Positivo: {s['positive']:,} ({pct_positive:.1f}%)")
        print(f"    Negativo: {s['negative']:,} ({pct_negative:.1f}%)")
        print(f"    Neutro:   {s['neutral']:,}")
        print(f"    Média:    {avg:+.4f}")

    # Simular polling (quem vota em quem)
    print("\n" + "=" * 70)
    print("SIMULAÇÃO DE POLLING (segundo turno Lula vs Flávio)")
    print("=" * 70)

    # Agrupar sentimentos por persona
    persona_sentiments: dict[str, dict[str, float]] = defaultdict(dict)
    for row in rows_to_insert:
        persona_sentiments[row["persona_id"]][row["candidate_id"]] = row["sentiment"]

    votes = defaultdict(int)
    abstentions = 0

    for pid, sents in persona_sentiments.items():
        # Segundo turno: só Lula vs Flávio
        s_lula = sents.get("lula", 0)
        s_flavio = sents.get("flavio", 0)

        # Threshold de abstenção
        if max(s_lula, s_flavio) < 0.05:
            abstentions += 1
            continue
        if abs(s_lula - s_flavio) < 0.03:
            abstentions += 1  # indeciso
            continue

        if s_lula > s_flavio:
            votes["lula"] += 1
        else:
            votes["flavio"] += 1

    total_valid = votes["lula"] + votes["flavio"]
    if total_valid > 0:
        pct_lula = votes["lula"] / total_valid * 100
        pct_flavio = votes["flavio"] / total_valid * 100
    else:
        pct_lula = pct_flavio = 0

    print(f"\n  Lula:     {votes['lula']:,} votos ({pct_lula:.1f}%)")
    print(f"  Flávio:   {votes['flavio']:,} votos ({pct_flavio:.1f}%)")
    print(f"  Abstenção: {abstentions:,}")
    print(f"\n  META: Flávio ~47% / Lula ~46%")
    print(f"  RESULTADO: Flávio {pct_flavio:.1f}% / Lula {pct_lula:.1f}%")

    if abs(pct_flavio - 47) < 3 and abs(pct_lula - 46) < 3:
        print("  ✓ Dentro da faixa aceitável (±3%)")
    else:
        print("  ✗ Fora da faixa — ajustar derivação e rodar novamente")

    # 4. Salvar no banco
    if args.dry_run:
        print(f"\n[DRY RUN] {len(rows_to_insert):,} linhas seriam inseridas. Nada foi salvo.")
        return

    print(f"\n[Calibração] Inserindo {len(rows_to_insert):,} linhas em persona_sentiments...")

    # Limpar sentimentos existentes
    print("[Calibração] Limpando sentimentos anteriores...")
    sb.table("persona_sentiments").delete().neq("persona_id", "00000000-0000-0000-0000-000000000000").execute()

    # Inserir em batches de 500
    insert_batch_size = 500
    inserted = 0

    for i in range(0, len(rows_to_insert), insert_batch_size):
        batch = rows_to_insert[i:i + insert_batch_size]
        sb.table("persona_sentiments").upsert(batch).execute()
        inserted += len(batch)
        if inserted % 5000 == 0 or inserted == len(rows_to_insert):
            print(f"  {inserted:,}/{len(rows_to_insert):,} inseridos...")

    # 5. Computar polling
    print("[Calibração] Computando polling...")
    result = sb.rpc("compute_polling").execute()
    print(f"  Resultado: {result.data}")

    print(f"\n[Calibração] Completo! {inserted:,} sentimentos inseridos.")


if __name__ == "__main__":
    main()
