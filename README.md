# 🥃 VucciriaGame

A multiplayer drinking board game for 2–10 friends. Pick a nickname, pick an emoji, share a 6-character code, and you're in.

- **No accounts.** No email, no password.
- **No backend.** True peer-to-peer over WebRTC. Game state lives on your devices.
- **No tracking.** Your name and emoji never leave your phone.
- **Installable PWA.** Works offline once loaded.

Built with React, TypeScript, Vite, Trystero (WebRTC P2P), and Yjs (CRDT for shared game state).

## How it works

1. Open the app, pick a nickname and an emoji avatar.
2. Create a game (set name, max players, starting shots 🥃).
3. Share the 6-character code with friends.
4. When everyone's in, host taps **Start**.
5. Take turns drawing cards. Each card tells you (or someone) to drink. Lose all your shots and you're out. Last player standing wins.

### Lives are shots 🥃

Every player starts with N shot glasses. Each glass = one life:

- Full color 🥃 → you still have shots to take.
- Dimmed/greyscale 🥃 → shot already gone.

Reach 0 and you're eliminated.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 — and a second tab/device — to test multiplayer.

## Tests

```bash
pnpm test:run     # unit tests (Vitest)
pnpm e2e:install  # one-time: install Playwright browsers
pnpm e2e          # end-to-end tests (Playwright)
```

The E2E suite includes a two-context test that simulates two peers joining the same lobby over Trystero's default public MQTT brokers.

## Deploy

Push to `main` — GitHub Actions builds and deploys to GitHub Pages. The workflow auto-sets `BASE_PATH` to `/<repo-name>/`.

For a custom domain or root deployment, override `BASE_PATH` in `.github/workflows/deploy.yml`.

## Tech notes

- **P2P transport:** [Trystero](https://github.com/dmotz/trystero), MQTT strategy by default. The discovery strategy is configurable at build time via `VITE_TRYSTERO_STRATEGY` (one of `mqtt`, `nostr`, `torrent`) — useful when a given network blocks WebSocket brokers. See `.env.example` for details.
- **Shared state:** [Yjs](https://yjs.dev) `Y.Doc` with a `meta` map, a `players` map, and a `deck` array. CRDT means concurrent mutations (e.g. host adjusting lives + someone ending their turn) merge cleanly with no race conditions.
- **Persistence:** `y-indexeddb` persists the game state locally so a refresh during a game doesn't drop your seat. Cleared on Game Over.
- **Host migration:** the host is just the lowest-seat alive player. If the host leaves, the next player takes over automatically (no manual handoff).
- **Encryption:** Trystero derives an AES-GCM key from the 6-char game code. Only peers with the code can join the room.

## License

MIT — see [LICENSE](./LICENSE).
