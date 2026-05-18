# VucciriaGame — Local OpenCode Registry

Project-scoped agents, commands, skills, and MCP servers. These are
**local-only**: they apply when OpenCode runs with this repo as the working
directory, and they live alongside your global configuration without
overriding it.

---

## 1. Project Context

VucciriaGame is a multiplayer drinking board game.

- **Runtime:** React 18 + TypeScript, bundled by Vite, shipped as a PWA.
- **P2P transport:** Trystero over WebRTC. Default strategy is MQTT (public brokers: Eclipse, HiveMQ, EMQX, Mosquitto).
- **Shared state:** Yjs CRDT. The `Y.Doc` per game has `meta` (Y.Map),
  `players` (Y.Map of Y.Map), `deck` (Y.Array<string>).
- **Persistence:** y-indexeddb per game code; cleared on Game Over.
- **No backend.** No database. No accounts. Pure static deploy on GitHub Pages.
- **i18n:** English + Italian; all user-visible strings live in
  `src/i18n/{en,it}.json`.
- **Lives:** rendered as shot glasses 🥃 — full color = alive,
  CSS-greyscale = lost. Class: `.life-glass-lost`.

When in doubt, prefer **simplicity over cleverness** — the codebase should
stay small enough for one person + Claude to maintain comfortably.

---

## 2. Agent Registry

| Name | Role | Trigger | File |
|------|------|---------|------|
| p2p-architect | Reasons about Trystero rooms, peer joins/leaves, host migration, NAT/TURN, encryption | `@p2p-architect` | `agent/p2p-architect.md` |
| yjs-doctor | Designs and debugs Y.Doc schemas and CRDT mutations | `@yjs-doctor` | `agent/yjs-doctor.md` |
| card-designer | Adds or tweaks game cards keeping types, icons, i18n in sync | `@card-designer` | `agent/card-designer.md` |
| pwa-shipper | Pre-deploy checks for manifest, icons, service worker, base path | `@pwa-shipper` | `agent/pwa-shipper.md` |
| i18n-keeper | Keeps `en.json` and `it.json` symmetric and well-translated | `@i18n-keeper` | `agent/i18n-keeper.md` |

---

## 3. Command Registry

| Trigger | Purpose | File |
|---------|---------|------|
| `/dev` | Start the dev server with helpful URLs | `command/dev.md` |
| `/test` | Run unit tests in watch mode | `command/test.md` |
| `/e2e` | Run Playwright end-to-end tests | `command/e2e.md` |
| `/lhci` | Run Lighthouse against a local preview build | `command/lhci.md` |
| `/new-card` | Scaffold a new card (data + i18n + types) | `command/new-card.md` |
| `/check-i18n` | Validate EN/IT catalogs are symmetric | `command/check-i18n.md` |
| `/ship` | Typecheck + lint + tests + build pre-flight | `command/ship.md` |

---

## 4. Skill Registry

| Name | Entry Point | Purpose |
|------|-------------|---------|
| deck_simulator | `skill/deck_simulator.py` | Simulate N games, log card distribution and game length |
| i18n_diff | `skill/i18n_diff.py` | Diff EN/IT JSON catalogs, report missing keys |
| code_generator_check | `skill/code_generator_check.py` | Stress-test the 6-char code generator's collision rate |
| manifest_validator | `skill/manifest_validator.py` | Validate the PWA web manifest |

---

## 5. MCP Server Registry

| Name | Transport | Purpose | File |
|------|-----------|---------|------|
| filesystem | stdio | Sandboxed filesystem access to this repo | `mcp/filesystem.json` |
| fetch | stdio | Pull latest Trystero / Yjs / Vite docs on demand | `mcp/fetch.json` |

---

## 6. Conventions

- TypeScript everywhere. `strict: true`. No `any` without justification.
- All user-visible strings go through `react-i18next` (`t('namespace.key')`).
- Game logic in `src/game/` stays **pure and serializable** — no React, no DOM, no async.
- State mutations on the Yjs doc must happen inside `doc.transact(() => ...)` if you change more than one field.
- Never bypass `useGameRoom` to create raw Trystero rooms.
- Lives UI: always use `<LifeGlass />` or `<LifeRow />`, never raw emojis.
- Before pushing, run `/ship`.
