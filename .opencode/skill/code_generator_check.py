"""Stress-test the 6-character game-code generator's collision rate.

This is a pure Python re-implementation of `src/game/codes.ts` so it
runs without Node. If you change the alphabet in TS, update it here too
(or extend the script to parse the TS file).

Usage:
    python3 .opencode/skill/code_generator_check.py [--samples 200000]
"""
from __future__ import annotations

import argparse
import secrets
import sys


# Must match the alphabet in src/game/codes.ts (after removing O/L).
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
ALPHABET = ALPHABET.replace("O", "").replace("L", "")
LENGTH = 6


def generate() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--samples", type=int, default=200_000)
    args = p.parse_args(argv)

    seen: set[str] = set()
    collisions = 0
    for _ in range(args.samples):
        c = generate()
        if c in seen:
            collisions += 1
        else:
            seen.add(c)

    space = len(ALPHABET) ** LENGTH
    print(f"Alphabet: {ALPHABET} (size={len(ALPHABET)})")
    print(f"Total possible codes: {space:,}")
    print(f"Samples: {args.samples:,}")
    print(f"Unique: {len(seen):,}")
    print(f"Collisions: {collisions}")
    print(f"Empirical collision rate: {collisions / args.samples:.6%}")
    # Birthday-paradox expected collisions ~ n^2 / (2 * space)
    expected = args.samples * args.samples / (2 * space)
    print(f"Expected (birthday): ~{expected:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
