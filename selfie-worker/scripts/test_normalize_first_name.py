"""Testes unitários puros do normalize_first_name (sem custo, sem rede).

USO:
    cd selfie-worker
    python scripts/test_normalize_first_name.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from steps.classify import normalize_first_name


def main():
    cases = [
        # (input, expected)
        ("Pedro Ricardo", "pedro"),
        ("João", "joao"),
        ("JOÃO SILVA", "joao"),
        ("Maria das Graças", "maria"),
        ("ÁGATA", "agata"),
        ("Pedro", "pedro"),
        ("  Lucas  ", "lucas"),
        ("Júnior Carlos Souza", "junior"),
        ("Sérgio", "sergio"),
        ("", ""),
        ("   ", ""),
        ("Anna-Maria", "anna-maria"),  # hífen preservado
    ]

    passed = 0
    failed = 0
    for raw, expected in cases:
        actual = normalize_first_name(raw)
        ok = actual == expected
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] normalize_first_name({raw!r:32s}) = {actual!r:12s} (esperado {expected!r})")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n{passed} passed, {failed} failed (of {len(cases)})")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
