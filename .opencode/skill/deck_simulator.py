"""Deck simulator skill.

Simulates N games of VucciriaGame and reports:
- Average game length (turns until a winner emerges).
- Distribution of cards drawn.
- Approximate "drinking pace" (drinks per turn).

Reads the card list from `src/game/cards.ts` so it stays in sync with code.

Usage:
    python3 .opencode/skill/deck_simulator.py [--games 1000] [--players 5] [--lives 3]
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CARDS_FILE = REPO_ROOT / "src" / "game" / "cards.ts"


def load_card_ids() -> list[str]:
    """Pull `id: '...'` strings out of cards.ts without parsing TS."""
    text = CARDS_FILE.read_text(encoding="utf-8")
    return re.findall(r"id:\s*'([^']+)'", text)


# Rough effect map (drinks delivered per card). Used for drinking-pace estimate only.
EFFECT_DRINKS: dict[str, int] = {
    "mossa": 1,
    "bevi": 1,
    "beviOoffri": 1,
    "treAveMaria": 3,
    "tuEcumpari": 2,
    "jolly": -1,  # gain a life
    "pipi": 0,
    "sfida": 1,
    "setteBum": 1,
    "ventuno": 1,
    "storia": 1,
    "zingBoing": 1,
    "bevonoTutti": 5,  # everyone drinks (assumes ~5 players)
}


def simulate(games: int, players: int, lives: int, seed: int = 0) -> dict:
    rng = random.Random(seed)
    cards = load_card_ids()
    if not cards:
        raise SystemExit("Could not parse cards from cards.ts")

    draw_counter: Counter = Counter()
    turn_counts: list[int] = []
    total_drinks = 0
    total_turns = 0

    for _ in range(games):
        deck = cards[:]
        rng.shuffle(deck)
        deck_idx = 0
        lives_left = [lives] * players
        turn = 0
        seat = 0
        while sum(1 for l in lives_left if l > 0) > 1:
            if lives_left[seat] <= 0:
                seat = (seat + 1) % players
                continue
            if deck_idx >= len(deck):
                rng.shuffle(deck)
                deck_idx = 0
            card = deck[deck_idx]
            deck_idx += 1
            draw_counter[card] += 1

            delta = EFFECT_DRINKS.get(card, 1)
            if delta < 0:
                lives_left[seat] = min(lives + 2, lives_left[seat] + 1)
            else:
                total_drinks += delta
                # Distribute deaths roughly: cost falls on `seat`
                lives_left[seat] = max(0, lives_left[seat] - 1)

            seat = (seat + 1) % players
            turn += 1
            if turn > 5000:
                break  # safety
        turn_counts.append(turn)
        total_turns += turn

    return {
        "games": games,
        "players": players,
        "starting_lives": lives,
        "avg_turns": total_turns / games,
        "min_turns": min(turn_counts),
        "max_turns": max(turn_counts),
        "card_distribution": dict(draw_counter.most_common()),
        "drinks_per_turn": total_drinks / total_turns if total_turns else 0,
    }


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--games", type=int, default=1000)
    p.add_argument("--players", type=int, default=5)
    p.add_argument("--lives", type=int, default=3)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args(argv)

    result = simulate(args.games, args.players, args.lives, args.seed)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
