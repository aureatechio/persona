"""Backfill archetype_primary for all personas that have it NULL."""
import os
import random
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

PAGE = 1000


def pick_weighted(options):
    values, weights = zip(*options)
    return random.choices(values, weights=weights, k=1)[0]


def get_archetype(political, religion, social_class, age):
    if political in ("Direita", "Centro-Direita", "Extrema Direita"):
        if religion in ("Católico", "Evangélico/Protestante"):
            return pick_weighted([
                ("O Governante", 25), ("O Cidadão Comum", 30), ("O Cuidador", 20), ("O Herói", 15), ("O Inocente", 10),
            ])
        return pick_weighted([
            ("O Governante", 30), ("O Explorador", 25), ("O Criador", 20), ("O Herói", 15), ("O Cidadão Comum", 10),
        ])
    if political in ("Esquerda", "Centro-Esquerda", "Extrema Esquerda"):
        return pick_weighted([
            ("O Rebelde", 20), ("O Cuidador", 25), ("O Herói", 15), ("O Sábio", 15), ("O Cidadão Comum", 15), ("O Comediante", 10),
        ])
    if political in ("Centro", "Centro-Liberal", "Libertário"):
        return pick_weighted([
            ("O Sábio", 20), ("O Explorador", 20), ("O Cidadão Comum", 15), ("O Criador", 15), ("O Mago", 15), ("O Governante", 15),
        ])
    return pick_weighted([
        ("O Cidadão Comum", 35), ("O Inocente", 20), ("O Cuidador", 20), ("O Amante", 15), ("O Comediante", 10),
    ])


def main():
    res = sb.table("personas").select("id", count="exact").is_("archetype_primary", "null").limit(0).execute()
    total = res.count or 0
    print(f"Personas with NULL archetype_primary: {total}")
    if total == 0:
        print("Nothing to backfill.")
        return

    updated = 0
    while True:
        # Always fetch from offset 0 since NULLs shrink each round
        batch = (
            sb.table("personas")
            .select("id, political_leaning, macro_religion, social_class, age")
            .is_("archetype_primary", "null")
            .limit(PAGE)
            .execute()
        ).data or []

        if not batch:
            break

        for p in batch:
            arch = get_archetype(
                p.get("political_leaning") or "",
                p.get("macro_religion") or "",
                p.get("social_class") or "",
                p.get("age") or 30,
            )
            sb.table("personas").update({"archetype_primary": arch}).eq("id", p["id"]).execute()
            updated += 1

        print(f"  Updated {updated}/{total}")

    print(f"Done. Backfilled {updated} personas.")


if __name__ == "__main__":
    main()
