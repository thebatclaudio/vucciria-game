"""i18n diff skill.

Compares `src/i18n/en.json` and `src/i18n/it.json`:
- Keys missing in either.
- Interpolation variables ({{var}}) that don't match.

Exits with code 1 if any mismatch is found, so it can be wired into CI.

Usage:
    python3 .opencode/skill/i18n_diff.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Iterator


REPO_ROOT = Path(__file__).resolve().parents[2]
EN_FILE = REPO_ROOT / "src" / "i18n" / "en.json"
IT_FILE = REPO_ROOT / "src" / "i18n" / "it.json"

VAR_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def flatten(obj: dict, prefix: str = "") -> Iterator[tuple[str, str]]:
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            yield from flatten(v, key)
        else:
            yield key, str(v)


def vars_of(s: str) -> set[str]:
    return set(VAR_RE.findall(s))


def main() -> int:
    en = dict(flatten(json.loads(EN_FILE.read_text(encoding="utf-8"))))
    it = dict(flatten(json.loads(IT_FILE.read_text(encoding="utf-8"))))

    missing_in_it = sorted(set(en) - set(it))
    missing_in_en = sorted(set(it) - set(en))

    var_mismatches: list[tuple[str, set[str], set[str]]] = []
    for key in sorted(set(en) & set(it)):
        ev, iv = vars_of(en[key]), vars_of(it[key])
        if ev != iv:
            var_mismatches.append((key, ev, iv))

    print(f"EN keys: {len(en)}, IT keys: {len(it)}")
    if missing_in_it:
        print(f"\nMissing in IT ({len(missing_in_it)}):")
        for k in missing_in_it:
            print(f"  - {k}  →  EN: {en[k]!r}")
    if missing_in_en:
        print(f"\nMissing in EN ({len(missing_in_en)}):")
        for k in missing_in_en:
            print(f"  - {k}  →  IT: {it[k]!r}")
    if var_mismatches:
        print(f"\nInterpolation variable mismatches ({len(var_mismatches)}):")
        for k, ev, iv in var_mismatches:
            print(f"  - {k}: EN vars {ev or '{}'} vs IT vars {iv or '{}'}")

    ok = not (missing_in_it or missing_in_en or var_mismatches)
    if ok:
        print("\n✅ EN and IT catalogs are symmetric and consistent.")
        return 0
    print("\n❌ Catalogs need attention.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
