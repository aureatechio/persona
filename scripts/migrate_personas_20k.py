#!/usr/bin/env python3
"""
Migration script: Delete old 2K personas → Insert new 20K personas.

PREREQUISITE: Run add_columns.sql in Supabase Dashboard SQL Editor first.

Usage:
  python3 scripts/migrate_personas_20k.py
"""

import csv
import sys
import time
import requests
import json

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://sobfplitrzgggzqsycew.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxNjg1OCwiZXhwIjoyMDgzODkyODU4fQ.MLZa1crIU7Uid70GFsRPPkoWZ1TgzDDSej99eYD3ctg"

CSV_PATH = "/Users/arthurcavallini/Downloads/files (1)/personas_20mil_eleitorado_brasileiro.csv"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

HEADERS_READ = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
}

# ── Cluster → nome_grupo mapping ──────────────────────────────────────────────

CLUSTER_NAMES = {
    "P1": "Base Social", "P2": "Trabalhista", "P3": "Progressista Urbano",
    "P4": "Regulador Técnico", "P5": "Desenvolvimentista", "P6": "Centro-Esquerda Moderada",
    "M1": "Centro Econômico", "M2": "Centro Conservador", "M3": "Institucional",
    "M4": "Gestor Pragmático", "M5": "Volátil Econômico", "M6": "Empreendedor Urbano",
    "M7": "Classe Média Sensível", "M8": "Cético Político",
    "C1": "Liberal de Mercado", "C2": "Conservador Religioso", "C3": "Nacionalista",
    "C4": "Linha Dura Segurança", "C5": "Antissistema", "C6": "Pequeno Empresário",
    "C7": "Direita Digital", "C8": "Conservador Tradicional",
    "T1": "Desengajado", "T2": "Anti-Incumbente",
}

# ── Mappings ──────────────────────────────────────────────────────────────────

EDUCATION_MAP = {
    "Fundamental incompleto": "Fundamental",
    "Fundamental completo": "Fundamental",
    "Médio incompleto": "Médio",
    "Médio completo": "Médio",
    "Superior incompleto": "Superior Incompleto",
    "Superior completo": "Superior Completo",
    "Mestrado": "Mestrado/Doutorado",
    "Doutorado": "Mestrado/Doutorado",
}

SOCIAL_CLASS_MAP = {
    "A": "A", "B1": "B1", "B2": "B2",
    "C1": "C1", "C2": "C2", "D-E": "D",
}

RELIGION_MAP = {
    "Católica": "Católico",
    "Evangélica": "Evangélico/Protestante",
    "Sem religião": "Ateu/Agnóstico",
    "Espírita": "Espírita (Kardecista)",
    "Umbanda/Candomblé": "Matriz Africana (Candomblé/Umbanda)",
    "Outras": "Outros",
}

AREA_MAP = {
    "Urbana": "Urbana/Interior",
    "Rural": "Rural",
}

# All q_ columns in the CSV
Q_INT_COLS = [
    "q_confianca_stf", "q_confianca_congresso", "q_confianca_imprensa",
    "q_confianca_policia", "q_confianca_exercito", "q_confianca_igreja",
    "q_democracia_importante",
]

Q_TEXT_COLS = [
    "q_maior_problema", "q_avaliacao_bolsonaro", "q_corrupcao_problema",
    "q_reeleicao", "q_voto_obrigatorio", "q_impeachment_lula",
    "q_pt_comunista", "q_bolsonaro_ditador", "q_fake_news_problema",
    "q_redes_sociais_censuradas", "q_intervencao_militar",
    "q_sistema_eleitoral_confiavel", "q_politico_favorito",
    "q_situacao_economica", "q_perspectiva_futuro", "q_salario_minimo_aumentar",
    "q_reforma_tributaria", "q_imposto_ricos", "q_estado_tamanho",
    "q_bolsa_familia_bom", "q_auxilio_emergencial_voltar",
    "q_desemprego_principal", "q_inflacao_controle", "q_bitcoin_confiar",
    "q_banco_central_independente", "q_teto_gastos", "q_previdencia_reforma",
    "q_13_salario_manter",
    "q_familia_tradicional", "q_feminismo_bom", "q_racismo_estrutural",
    "q_meritocracia", "q_genero_biologico", "q_linguagem_neutra",
    "q_ideologia_genero_escola", "q_adocao_homoafetiva", "q_direitos_lgbt",
    "q_mulher_presidente", "q_divorcio_facilitar", "q_religiao_politica",
    "q_aborto_estupro", "q_prostituicao_legalizar", "q_poligamia",
    "q_pena_morte", "q_prisao_perpetua", "q_maioridade_penal_16",
    "q_policia_violenta", "q_drogas_descriminalizar", "q_crack_internar_forcado",
    "q_seguranca_prioridade", "q_camera_facial_aceita",
    "q_abordagem_policial_ja_sofreu", "q_justica_funciona",
    "q_mudanca_climatica_real", "q_amazonia_preservar", "q_agronegocio_desmata",
    "q_energia_renovavel", "q_vacinas_confiar", "q_ciencia_importante",
    "q_queimadas_criminosas", "q_terra_plana",
    "q_sus_funciona", "q_universidade_publica_gratuita", "q_homeschooling",
    "q_ensino_distancia", "q_escola_particular_melhor", "q_medicina_publica_boa",
    "q_plano_saude_tem", "q_enem_justo",
    "q_midia_principal", "q_whatsapp_noticias", "q_instagram_usa",
    "q_tiktok_usa", "q_youtube_assiste", "q_podcast_ouve", "q_streaming_assina",
    "q_brasil_mundo_importante", "q_eua_aliado", "q_china_ameaca", "q_imigracao",
    "q_voto_influenciado_por", "q_muda_voto_facilmente", "q_pesquisa_influencia",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def derive_generation(age: int) -> str:
    if age <= 27:
        return "Gen Z"
    elif age <= 43:
        return "Millennial"
    elif age <= 59:
        return "Gen X"
    else:
        return "Boomer"


def derive_political_leaning(score_eco: float, score_cost: float) -> str:
    magnitude = (abs(score_eco) + abs(score_cost)) / 2
    if magnitude < 0.15:
        return "Centro"
    avg = (score_eco + score_cost) / 2
    if avg < -0.5:
        return "Extrema Esquerda" if score_cost < -0.5 else "Esquerda"
    elif avg < -0.15:
        return "Centro-Esquerda"
    elif avg < 0.15:
        if score_eco > 0.2:
            return "Centro-Liberal"
        return "Centro"
    elif avg < 0.5:
        return "Centro-Direita"
    else:
        return "Extrema Direita" if score_cost > 0.5 else "Direita"


def parse_numeric(val: str):
    if not val or val.strip() == "" or val == "-":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_int(val: str):
    if not val or val.strip() == "" or val == "-":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def clean_val(val: str):
    v = val.strip() if val else ""
    return v if v and v != "-" else None


# ── Check columns exist ──────────────────────────────────────────────────────

def check_columns_exist():
    """Verify new columns exist by trying to select one."""
    url = f"{SUPABASE_URL}/rest/v1/personas?select=raca_cor&limit=0"
    r = requests.get(url, headers=HEADERS_READ)
    if r.status_code != 200:
        print("❌ New columns not found in database!")
        print("   Please run add_columns.sql in Supabase Dashboard SQL Editor first.")
        print(f"   File: scripts/add_columns.sql")
        sys.exit(1)
    print("✓ New columns verified")


# ── Delete all personas ───────────────────────────────────────────────────────

def delete_all_personas():
    print("\n═══ Deleting all existing personas ═══")
    total_deleted = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/personas?select=id&limit=1000"
        r = requests.get(url, headers=HEADERS_READ)
        if r.status_code != 200:
            print(f"  Error fetching IDs: {r.status_code}")
            return False
        rows = r.json()
        if not rows:
            break
        ids = [str(row["id"]) for row in rows]
        delete_url = f"{SUPABASE_URL}/rest/v1/personas?id=in.({','.join(ids)})"
        r = requests.delete(delete_url, headers={
            **HEADERS_READ,
            "Prefer": "return=minimal",
        })
        if r.status_code not in (200, 204):
            print(f"  Error deleting: {r.status_code} {r.text[:200]}")
            return False
        total_deleted += len(ids)
        print(f"  Deleted {total_deleted}...")
    print(f"  ✓ Total deleted: {total_deleted}")
    return True


# ── Map CSV row → DB row ──────────────────────────────────────────────────────

def map_row(row: dict) -> dict:
    age = parse_int(row.get("idade", "0")) or 18
    score_eco = parse_numeric(row.get("score_economico", "0")) or 0.0
    score_cost = parse_numeric(row.get("score_costumes", "0")) or 0.0
    cluster_id = row.get("cluster", "").strip()
    sexo = row.get("sexo", "").strip()

    db_row = {
        "name": row.get("nome_completo", "").strip(),
        "apelido_politico": clean_val(row.get("apelido_politico", "")),
        "age": age,
        "gender": sexo,
        "gender_identity": sexo,
        "civil_status": row.get("estado_civil", "").strip() if row.get("estado_civil", "").strip() not in ("NS/NR", "") else "Solteiro",
        "education_level": EDUCATION_MAP.get(
            row.get("escolaridade", "").strip(),
            row.get("escolaridade", "").strip()
        ),
        "social_class": SOCIAL_CLASS_MAP.get(
            row.get("classe_economica", "").strip(),
            row.get("classe_economica", "").strip()
        ),
        "region_br": row.get("regiao", "").strip(),
        "state": row.get("uf", "").strip(),
        "city": row.get("municipio", "").strip(),
        "area_type": AREA_MAP.get(
            row.get("zona", "").strip(),
            row.get("zona", "").strip()
        ),
        "macro_religion": RELIGION_MAP.get(
            row.get("religiao", "").strip(),
            row.get("religiao", "").strip()
        ),
        "cluster_id": cluster_id,
        "nome_grupo": CLUSTER_NAMES.get(cluster_id, cluster_id),
        "score_economico": score_eco,
        "score_costumes": score_cost,
        "generation": derive_generation(age),
        "political_leaning": derive_political_leaning(score_eco, score_cost),
        # New flat columns
        "raca_cor": row.get("raca_cor", "").strip(),
        "religiao_subtipo": clean_val(row.get("religiao_subtipo", "")),
        "voto_2022": row.get("voto_2022", "").strip(),
        "aprovacao_lula": row.get("aprovacao_lula", "").strip(),
        "voto_2026": row.get("voto_2026", "").strip(),
        "tema_aborto": row.get("tema_aborto", "").strip(),
        "tema_armas": row.get("tema_armas", "").strip(),
        "tema_maconha": row.get("tema_maconha", "").strip(),
        "tema_privatizacoes": row.get("tema_privatizacoes", "").strip(),
        "tema_cotas_raciais": row.get("tema_cotas_raciais", "").strip(),
        "tema_casamento_gay": row.get("tema_casamento_gay", "").strip(),
        "time_futebol": row.get("time_futebol", "").strip(),
        "recebe_beneficio": row.get("recebe_beneficio", "").strip(),
        "usa_transporte_publico": row.get("usa_transporte_publico", "").strip(),
        # Omit JSON columns — they'll use DB defaults (empty {})
    }

    # Questionnaire integer columns
    for col in Q_INT_COLS:
        db_row[col] = parse_int(row.get(col, ""))

    # Questionnaire text columns
    for col in Q_TEXT_COLS:
        db_row[col] = clean_val(row.get(col, ""))

    return db_row


# ── Insert batch ──────────────────────────────────────────────────────────────

def insert_batch(rows: list) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/personas"
    r = requests.post(url, headers=HEADERS, json=rows)
    if r.status_code in (200, 201):
        return True
    print(f"    ERROR {r.status_code}: {r.text[:400]}")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Synthetic Person — Migration: 2K → 20K Personas       ║")
    print("╚══════════════════════════════════════════════════════════╝")

    # Step 0: Verify columns exist
    check_columns_exist()

    # Step 1: Delete existing personas
    if not delete_all_personas():
        print("❌ Failed to delete personas")
        sys.exit(1)

    # Step 2: Read CSV and insert
    print(f"\n═══ Reading CSV and inserting 20K personas ═══")
    print(f"  File: {CSV_PATH}")

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        total = 0
        errors = 0
        batch_size = 500
        start = time.time()

        for row in reader:
            try:
                db_row = map_row(row)
                batch.append(db_row)
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Error mapping row: {e}")
                continue

            if len(batch) >= batch_size:
                if insert_batch(batch):
                    total += len(batch)
                    elapsed = time.time() - start
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  ✓ {total:>6,} personas ({rate:.0f}/s)")
                else:
                    # Retry individually to find problem rows
                    for single_row in batch:
                        if insert_batch([single_row]):
                            total += 1
                        else:
                            errors += 1
                batch = []

        # Insert remaining
        if batch:
            if insert_batch(batch):
                total += len(batch)
            else:
                for single_row in batch:
                    if insert_batch([single_row]):
                        total += 1
                    else:
                        errors += 1

    elapsed = time.time() - start
    print(f"\n╔══════════════════════════════════════════════════════════╗")
    print(f"║  Migration complete!                                    ║")
    print(f"║  Inserted: {total:>6,} personas                          ║")
    print(f"║  Errors:   {errors:>6,}                                    ║")
    print(f"║  Time:     {elapsed:>6.1f}s                                   ║")
    print(f"╚══════════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()
