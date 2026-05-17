---
type: command
trigger: "/new-card"
---

# /new-card

## Purpose

Scaffold a new game card across all the files that need to stay in sync.

## Usage

```
/new-card <id> <icon> <type> "<EN title>" "<EN desc>" "<IT title>" "<IT desc>"
```

## Parameters

- `id` — camelCase identifier (also the i18n key suffix).
- `icon` — single emoji.
- `type` — one of `auto` / `choice` / `minigame` / `mossa`.
- `EN title`, `EN desc` — English text.
- `IT title`, `IT desc` — Italian text.

## Behavior

Invokes `@card-designer` to:
1. Add entry to `src/game/cards.ts`.
2. Add translations to `src/i18n/en.json` and `src/i18n/it.json`.
3. Update `tests/unit/deck.test.ts` if the card count changes.
4. Optionally run `deck_simulator` skill for balance feedback.

## Example

**Input:**
```
/new-card cinCin 🥂 auto "Cheers!" "Player to your right drinks." "Cin cin!" "Beve chi è alla tua destra."
```

**Output:** Shows diffs for `cards.ts`, `en.json`, `it.json`, and a balance note.

## See also

- `@card-designer`
- `/check-i18n`
