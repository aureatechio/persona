"""Smoke test do classify_theme contra a lista REAL de temas no banco.

Gasta ~$0.001 em chamadas GPT-4o-mini. Precisa de .env carregado com
OPENAI_API_KEY + SUPABASE_*.

USO:
    cd selfie-worker
    python scripts/test_classify_theme.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db
from steps.classify_theme import classify_theme, DEFAULT_THEME_SLUG


CASES = [
    # (depoimento, slug esperado OU None se aceita "padrao")
    ("As escolas da minha cidade estão um lixo, falta professor e a estrutura é precária", "educacao"),
    ("Tô sem emprego há 6 meses, ninguém contrata aqui no interior", "emprego_interior"),
    ("A violência aqui no bairro tá demais, facção dominou tudo", "seguranca_crime_organizado"),
    ("Não temos saneamento, esgoto a céu aberto, água do rio sem tratar", "saneamento_basico"),
    ("A seca isolou minha comunidade, ficamos sem água nem comida por semanas", "seca_clima"),
    ("Internet no meu município é horrível, não consigo nem fazer telemedicina", "internet_interior"),
    ("Minha cidade não tem hospital, pra atendimento sério tem que ir 8 horas de barco", "saude_interior"),
    ("O preço da comida aqui é absurdo, tudo vem de barco e é o dobro do Sul", "custo_vida"),
    ("Estão querendo acabar com a Zona Franca, vai destruir o emprego de todo mundo", "zona_franca_manaus"),
    ("As ruas estão esburacadas, o ônibus em Manaus é uma vergonha", "mobilidade_manaus"),
    ("Sou indígena Yanomami, minha aldeia tá sofrendo com garimpeiro e fome", "povos_indigenas"),
    ("oi tudo bem? só queria mandar um abraço", None),  # padrao aceitável
]


def main():
    themes = db.get_themes_template()
    if not themes:
        print("ERROR: get_themes_template() retornou vazio. Roda a migration?")
        sys.exit(2)

    print(f"Loaded {len(themes)} temas. Rodando {len(CASES)} casos...\n")

    passed = 0
    soft = 0  # padrao foi escolhido onde havia expectativa específica
    failed = 0

    for transcript, expected in CASES:
        actual = classify_theme(transcript, themes)
        if expected is None:
            ok = actual == DEFAULT_THEME_SLUG
            mark = "PASS" if ok else "INFO"
        else:
            if actual == expected:
                ok = True
                mark = "PASS"
            elif actual == DEFAULT_THEME_SLUG:
                ok = False
                mark = "SOFT"  # caiu no padrao quando devia ter classificado
            else:
                ok = False
                mark = "FAIL"

        print(f"  [{mark}] {actual:30s} | esperado={expected or 'padrao'!s:30s} | {transcript[:60]}")

        if ok:
            passed += 1
        elif mark == "SOFT":
            soft += 1
        else:
            failed += 1

    print(f"\n{passed} passed, {soft} soft-fail (caiu em padrao), {failed} hard-fail — total {len(CASES)}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
