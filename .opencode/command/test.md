---
type: command
trigger: "/test"
---

# /test

## Purpose

Run unit tests (Vitest) in watch mode.

## Usage

```
/test [pattern]
```

## Parameters

- `pattern` — optional substring or glob to filter test files.

## Behavior

Runs `pnpm test -- [pattern]`. Watches for file changes and re-runs.
For a single CI-style run, use `pnpm test:run` directly.

## Example

**Input:** `/test deck`

**Output:** Vitest watches and runs only files matching "deck".

## See also

- `/e2e` — end-to-end Playwright tests
- `/ship` — full pre-flight including tests
