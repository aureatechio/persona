#!/usr/bin/env python3
"""
Backfill lat/lng coordinates for all personas based on city + state.

Uses batch PATCH per city-state combo for speed (~100 API calls instead of 20K).
MarkerCluster handles overlapping coords at the same city.

Usage: python3 scripts/backfill_coords.py
"""

import requests
import time
import urllib.parse

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://sobfplitrzgggzqsycew.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxNjg1OCwiZXhwIjoyMDgzODkyODU4fQ.MLZa1crIU7Uid70GFsRPPkoWZ1TgzDDSej99eYD3ctg"

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

# ── City coordinates ─────────────────────────────────────────────────────────

CITY_COORDS = {
    "Rio Branco-AC": (-9.97, -67.81), "Cruzeiro do Sul-AC": (-7.63, -72.67), "Sena Madureira-AC": (-9.07, -68.66),
    "Maceió-AL": (-9.67, -35.74), "Arapiraca-AL": (-9.75, -36.66), "Rio Largo-AL": (-9.48, -35.84), "Palmeira dos Índios-AL": (-9.41, -36.63),
    "Manaus-AM": (-3.12, -60.02), "Coari-AM": (-4.09, -63.14), "Itacoatiara-AM": (-3.14, -58.44), "Parintins-AM": (-2.63, -56.73),
    "Macapá-AP": (0.03, -51.05), "Santana-AP": (0.06, -51.17), "Laranjal do Jari-AP": (-0.80, -52.46),
    "Salvador-BA": (-12.97, -38.51), "Feira de Santana-BA": (-12.27, -38.97), "Vitória da Conquista-BA": (-14.86, -40.84),
    "Camaçari-BA": (-12.70, -38.33), "Juazeiro-BA": (-9.42, -40.50), "Itabuna-BA": (-14.79, -39.28),
    "Ilhéus-BA": (-14.79, -39.05), "Barreiras-BA": (-12.15, -45.00),
    "Fortaleza-CE": (-3.72, -38.53), "Caucaia-CE": (-3.74, -38.65), "Juazeiro do Norte-CE": (-7.21, -39.32),
    "Sobral-CE": (-3.69, -40.35), "Maracanaú-CE": (-3.87, -38.63), "Crato-CE": (-7.24, -39.41), "Itapipoca-CE": (-3.49, -39.58),
    "Brasília-DF": (-15.79, -47.88),
    "Vitória-ES": (-20.32, -40.34), "Serra-ES": (-20.13, -40.31), "Vila Velha-ES": (-20.33, -40.29),
    "Cariacica-ES": (-20.26, -40.42), "Cachoeiro de Itapemirim-ES": (-20.85, -41.11),
    "Linhares-ES": (-19.39, -40.07), "Colatina-ES": (-19.54, -40.63),
    "Goiânia-GO": (-16.69, -49.25), "Aparecida de Goiânia-GO": (-16.82, -49.24), "Anápolis-GO": (-16.33, -48.95),
    "Rio Verde-GO": (-17.80, -50.92), "Luziânia-GO": (-16.25, -47.95), "Águas Lindas de Goiás-GO": (-15.77, -48.28),
    "São Luís-MA": (-2.53, -44.28), "Imperatriz-MA": (-5.52, -47.47), "São José de Ribamar-MA": (-2.56, -44.06),
    "Timon-MA": (-5.09, -42.84), "Caxias-MA": (-4.87, -43.35), "Bacabal-MA": (-4.22, -44.78),
    "Belo Horizonte-MG": (-19.92, -43.94), "Uberlândia-MG": (-18.92, -48.28), "Contagem-MG": (-19.93, -44.05),
    "Juiz de Fora-MG": (-21.76, -43.35), "Betim-MG": (-19.97, -44.20), "Montes Claros-MG": (-16.73, -43.86),
    "Uberaba-MG": (-19.75, -47.93), "Governador Valadares-MG": (-18.85, -41.95), "Ipatinga-MG": (-19.47, -42.54),
    "Divinópolis-MG": (-20.14, -44.88), "Poços de Caldas-MG": (-21.79, -46.56), "Varginha-MG": (-21.55, -45.43),
    "Campo Grande-MS": (-20.44, -54.65), "Dourados-MS": (-22.22, -54.81), "Três Lagoas-MS": (-20.75, -51.68), "Corumbá-MS": (-19.01, -57.65),
    "Cuiabá-MT": (-15.60, -56.10), "Rondonópolis-MT": (-16.47, -54.64), "Sinop-MT": (-11.86, -55.51),
    "Várzea Grande-MT": (-15.65, -56.13), "Tangará da Serra-MT": (-14.62, -57.50),
    "Belém-PA": (-1.46, -48.50), "Ananindeua-PA": (-1.37, -48.39), "Santarém-PA": (-2.44, -54.71),
    "Marabá-PA": (-5.37, -49.12), "Castanhal-PA": (-1.30, -47.92), "Parauapebas-PA": (-6.07, -49.90), "Abaetetuba-PA": (-1.72, -48.88),
    "João Pessoa-PB": (-7.12, -34.86), "Campina Grande-PB": (-7.23, -35.88), "Santa Rita-PB": (-7.11, -34.98),
    "Patos-PB": (-7.02, -37.28), "Sousa-PB": (-6.76, -38.23),
    "Recife-PE": (-8.05, -34.87), "Jaboatão dos Guararapes-PE": (-8.18, -35.00), "Olinda-PE": (-8.01, -34.86),
    "Caruaru-PE": (-8.28, -35.97), "Petrolina-PE": (-9.39, -40.50), "Paulista-PE": (-7.94, -34.87), "Garanhuns-PE": (-8.89, -36.50),
    "Teresina-PI": (-5.09, -42.80), "Parnaíba-PI": (-2.90, -41.78), "Picos-PI": (-7.08, -41.47), "Floriano-PI": (-6.77, -43.02),
    "Curitiba-PR": (-25.43, -49.27), "Londrina-PR": (-23.31, -51.16), "Maringá-PR": (-23.42, -51.94),
    "Ponta Grossa-PR": (-25.09, -50.16), "Cascavel-PR": (-24.96, -53.46), "Foz do Iguaçu-PR": (-25.55, -54.59),
    "São José dos Pinhais-PR": (-25.54, -49.21), "Guarapuava-PR": (-25.39, -51.46),
    "Rio de Janeiro-RJ": (-22.91, -43.17), "São Gonçalo-RJ": (-22.83, -43.05), "Duque de Caxias-RJ": (-22.79, -43.31),
    "Nova Iguaçu-RJ": (-22.76, -43.45), "Niterói-RJ": (-22.88, -43.10), "Belford Roxo-RJ": (-22.76, -43.40),
    "Campos dos Goytacazes-RJ": (-21.75, -41.32), "Petrópolis-RJ": (-22.51, -43.18),
    "Volta Redonda-RJ": (-22.52, -44.10), "Macaé-RJ": (-22.37, -41.79), "Angra dos Reis-RJ": (-23.01, -44.32),
    "Natal-RN": (-5.79, -35.21), "Mossoró-RN": (-5.19, -37.34), "Parnamirim-RN": (-5.91, -35.26), "São Gonçalo do Amarante-RN": (-5.79, -35.33),
    "Porto Velho-RO": (-8.76, -63.90), "Ji-Paraná-RO": (-10.88, -61.95), "Ariquemes-RO": (-9.91, -63.04), "Vilhena-RO": (-12.74, -60.15),
    "Boa Vista-RR": (2.82, -60.67), "Rorainópolis-RR": (0.94, -60.44),
    "Porto Alegre-RS": (-30.03, -51.23), "Caxias do Sul-RS": (-29.17, -51.18), "Canoas-RS": (-29.92, -51.17),
    "Pelotas-RS": (-31.77, -52.34), "Gravataí-RS": (-29.94, -50.99), "Santa Maria-RS": (-29.68, -53.81),
    "Novo Hamburgo-RS": (-29.69, -51.13), "Passo Fundo-RS": (-28.26, -52.41),
    "Florianópolis-SC": (-27.60, -48.55), "Joinville-SC": (-26.30, -48.85), "Blumenau-SC": (-26.92, -49.07),
    "Chapecó-SC": (-27.10, -52.62), "Itajaí-SC": (-26.91, -48.66), "São José-SC": (-27.61, -48.64),
    "Criciúma-SC": (-28.68, -49.37), "Lages-SC": (-27.82, -50.33),
    "Aracaju-SE": (-10.91, -37.07), "Nossa Senhora do Socorro-SE": (-10.86, -37.13),
    "Lagarto-SE": (-10.92, -37.65), "Itabaiana-SE": (-10.69, -37.43),
    "São Paulo-SP": (-23.55, -46.63), "Guarulhos-SP": (-23.46, -46.53), "Campinas-SP": (-22.91, -47.06),
    "São Bernardo do Campo-SP": (-23.69, -46.56), "Santo André-SP": (-23.67, -46.54), "Osasco-SP": (-23.53, -46.79),
    "Santos-SP": (-23.96, -46.33), "São José dos Campos-SP": (-23.18, -45.88), "Ribeirão Preto-SP": (-21.18, -47.81),
    "Sorocaba-SP": (-23.50, -47.46), "Piracicaba-SP": (-22.73, -47.65), "Bauru-SP": (-22.31, -49.07),
    "Marília-SP": (-22.21, -49.95), "Presidente Prudente-SP": (-22.13, -51.39), "Araçatuba-SP": (-21.21, -50.43),
    "Botucatu-SP": (-22.89, -48.44), "Itu-SP": (-23.26, -47.30),
    "Palmas-TO": (-10.18, -48.33), "Araguaína-TO": (-7.19, -48.21), "Gurupi-TO": (-11.73, -49.07), "Porto Nacional-TO": (-10.71, -48.42),
}

# Build state capital fallback
STATE_CAPITALS = {}
for key, coords in CITY_COORDS.items():
    state = key.split("-")[-1]
    if state not in STATE_CAPITALS:
        STATE_CAPITALS[state] = coords


def get_coords(city, state):
    key = f"{city}-{state}"
    if key in CITY_COORDS:
        return CITY_COORDS[key]
    if state in STATE_CAPITALS:
        return STATE_CAPITALS[state]
    return (-15.79, -47.88)


# ── Step 1: Ensure columns exist ─────────────────────────────────────────────

def ensure_columns():
    url = f"{SUPABASE_URL}/rest/v1/personas?select=lat,lng&limit=1"
    r = requests.get(url, headers=HEADERS_READ)
    if r.status_code == 200:
        print("✓ lat/lng columns exist")
        return True
    print("✗ lat/lng columns not found!")
    print("")
    print("  Run this SQL in Supabase Dashboard > SQL Editor:")
    print("")
    print("  ALTER TABLE public.personas")
    print("    ADD COLUMN IF NOT EXISTS lat double precision,")
    print("    ADD COLUMN IF NOT EXISTS lng double precision;")
    print("")
    return False


# ── Step 2: Get unique city-state combos ─────────────────────────────────────

def get_unique_cities():
    """Get distinct city-state combos from DB."""
    print("\n═══ Fetching unique city-state combos ═══")
    all_rows = []
    offset = 0

    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/personas"
            f"?select=city,state"
            f"&or=(lat.is.null,lng.is.null)"
            f"&limit=1000&offset={offset}"
        )
        r = requests.get(url, headers=HEADERS_READ)
        if r.status_code != 200:
            print(f"  Error: {r.status_code} {r.text[:200]}")
            break
        rows = r.json()
        if not rows:
            break
        all_rows.extend(rows)
        offset += 1000

    # Deduplicate
    combos = set()
    for row in all_rows:
        city = (row.get("city") or "").strip()
        state = (row.get("state") or "").strip()
        if city and state:
            combos.add((city, state))

    print(f"  Total personas without coords: {len(all_rows)}")
    print(f"  Unique city-state combos: {len(combos)}")
    return combos, len(all_rows)


# ── Step 3: Batch update per city-state ──────────────────────────────────────

def update_by_city_state(combos):
    """Update all personas for each city-state combo in one PATCH request."""
    print(f"\n═══ Updating coordinates ({len(combos)} city-state groups) ═══")
    updated = 0
    errors = 0
    missing = []

    for i, (city, state) in enumerate(sorted(combos)):
        lat, lng = get_coords(city, state)
        key = f"{city}-{state}"
        if key not in CITY_COORDS:
            missing.append(key)

        # URL-encode city name for query param
        encoded_city = urllib.parse.quote(city)
        encoded_state = urllib.parse.quote(state)

        url = (
            f"{SUPABASE_URL}/rest/v1/personas"
            f"?city=eq.{encoded_city}&state=eq.{encoded_state}"
            f"&or=(lat.is.null,lng.is.null)"
        )
        r = requests.patch(url, headers=HEADERS, json={"lat": lat, "lng": lng})
        if r.status_code in (200, 204):
            updated += 1
        else:
            errors += 1
            print(f"  ✗ {city}-{state}: {r.status_code} {r.text[:100]}")

        if (i + 1) % 20 == 0:
            print(f"  Progress: {i + 1}/{len(combos)} city-state groups")

    if missing:
        print(f"\n  ⚠ {len(missing)} cities not in CITY_COORDS (used state capital fallback):")
        for m in missing[:10]:
            print(f"    - {m}")
        if len(missing) > 10:
            print(f"    ... and {len(missing) - 10} more")

    print(f"\n  ✓ City-state groups updated: {updated}")
    if errors > 0:
        print(f"  ✗ Errors: {errors}")

    return updated, errors


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Synthetic Person — Backfill lat/lng coordinates        ║")
    print("╚══════════════════════════════════════════════════════════╝")

    if not ensure_columns():
        return

    combos, total_personas = get_unique_cities()
    if not combos:
        print("\n✓ All personas already have coordinates!")
        return

    start = time.time()
    updated, errors = update_by_city_state(combos)
    elapsed = time.time() - start

    print(f"\n╔══════════════════════════════════════════════════════════╗")
    print(f"║  Backfill complete!                                     ║")
    print(f"║  Personas affected: ~{total_personas:<5,}                         ║")
    print(f"║  City-state groups: {updated:>5}                            ║")
    print(f"║  Time:              {elapsed:>5.1f}s                           ║")
    print(f"╚══════════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()
