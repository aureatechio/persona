"""Smoke test dos lookups de cache contra o banco real (read-only).

Não escreve nada. Só verifica que find_cached_name_sync e
find_cached_video conseguem consultar as colunas certas sem erro.

USO:
    cd selfie-worker
    python scripts/test_cache_lookups.py [base_model_id]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db


def main():
    # Pega base_model_id do arg ou usa o primeiro ativo
    if len(sys.argv) > 1:
        base_model_id = sys.argv[1]
    else:
        res = (
            db.client.table("video_base_models")
            .select("id, slug, display_name")
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not res.data:
            print("ERROR: nenhum base_model ativo encontrado")
            sys.exit(2)
        base_model_id = res.data[0]["id"]
        print(f"Usando base_model id={base_model_id} ({res.data[0].get('slug')})")

    print()

    # 1. get_themes_template
    themes = db.get_themes_template()
    print(f"[PASS] get_themes_template() retornou {len(themes)} temas (esperado 31)")
    if len(themes) != 31:
        print(f"  ⚠ esperado 31 mas veio {len(themes)} — migration rodada?")

    # 2. get_theme_model — pega um qualquer
    tm = db.get_theme_model(base_model_id, "educacao")
    if tm:
        print(f"[PASS] get_theme_model({base_model_id[:8]}.., 'educacao') = id={tm['id'][:8]}.. is_uploaded={tm.get('is_uploaded')}")
    else:
        print(f"[FAIL] get_theme_model retornou None — video_theme_models não foi populada pra esse base_model")

    # 3. get_theme_model com slug inexistente
    tm_invalid = db.get_theme_model(base_model_id, "slug_que_nao_existe")
    if tm_invalid is None:
        print(f"[PASS] get_theme_model retorna None pra slug inexistente")
    else:
        print(f"[FAIL] get_theme_model devia retornar None pra slug inexistente, retornou: {tm_invalid}")

    # 4. find_cached_name_sync (não esperamos resultado num banco fresh)
    cache_name = db.find_cached_name_sync(base_model_id, "joao")
    print(f"[INFO] find_cached_name_sync({base_model_id[:8]}.., 'joao') = {'HIT id='+cache_name['id'][:8]+'..' if cache_name else 'MISS (esperado num banco sem name_sync)'}")

    # 5. find_cached_video (cache legacy, theme_slug)
    cache_legacy = db.find_cached_video(base_model_id, "joao", "padrao")
    print(f"[INFO] find_cached_video({base_model_id[:8]}.., 'joao', 'padrao') = {'HIT id='+cache_legacy['id'][:8]+'..' if cache_legacy else 'MISS'}")

    print("\nDone.")


if __name__ == "__main__":
    main()
