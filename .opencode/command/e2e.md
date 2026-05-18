---
type: command
trigger: "/e2e"
---

# /e2e

## Purpose

Run Playwright end-to-end tests, including the two-peer multiplayer sync test.

## Usage

```
/e2e [--headed]
```

## Parameters

- `--headed` — run with visible browser windows (useful for debugging).

## Behavior

1. Ensures Playwright browsers are installed (`pnpm e2e:install` if needed).
2. Builds the app (`pnpm build`).
3. Starts a preview server.
4. Runs the spec files under `tests/e2e/`.

The `two-peer-game.spec.ts` test depends on Trystero's default MQTT brokers
being reachable. If flaky in CI, swap to a self-hosted broker.

## Example

**Input:** `/e2e`

**Output:**
```
Running 2 tests using 1 worker
  ✓ tests/e2e/solo-flow.spec.ts (3.2s)
  ✓ tests/e2e/two-peer-game.spec.ts (28.4s)

  2 passed (32s)
```

## See also

- `/test` — unit tests
- `/ship` — full pre-flight
