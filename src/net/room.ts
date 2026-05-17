import type { Room } from 'trystero'
import * as Y from 'yjs'

/**
 * Trystero room bound to a Yjs document.
 *
 * Sync protocol (kept intentionally tiny):
 *   - On peer join: send full Y state vector + state-as-update.
 *   - On local Y update: broadcast it.
 *
 * Trystero handles encryption (room password is derived from game code).
 *
 * Environment variables:
 *   VITE_TRYSTERO_STRATEGY  Discovery transport. One of: nostr | mqtt | torrent.
 *                           Defaults to `nostr`. Unknown values fall back to nostr.
 *   VITE_TRYSTERO_RELAYS    Optional comma-separated list of relay URLs for the
 *                           chosen strategy (overrides the strategy's defaults).
 *                           Example for mqtt:
 *                             VITE_TRYSTERO_RELAYS=wss://broker.emqx.io:8084/mqtt
 */

const APP_ID = 'vucciria-game-v2'

type TrysteroStrategy = 'nostr' | 'mqtt' | 'torrent'
type JoinRoomFn = typeof import('trystero').joinRoom

/**
 * Resolve which Trystero strategy module to use. Bound at module load (top-level
 * await) so `joinGameRoom` stays synchronous and the rest of the app can keep
 * treating room creation as a non-async operation.
 *
 * Vite replaces `import.meta.env.VITE_TRYSTERO_STRATEGY` with a string literal
 * at build time. When the variable is set, the `switch` constant-folds and
 * only the chosen strategy ends up in the production bundle. When it's
 * unset (the typical case), Vite emits each strategy as a separate dynamic
 * chunk and only the one matching the runtime value of the variable
 * (defaulting to `nostr`) is actually fetched — so the network footprint
 * is the same, at the cost of a few KB of extra manifest entries.
 */
async function resolveStrategy(): Promise<{
  joinRoom: JoinRoomFn
  selfId: string
  strategy: TrysteroStrategy
}> {
  // We compare `import.meta.env.VITE_TRYSTERO_STRATEGY` to string literals
  // directly inside each branch (instead of normalizing to a variable first)
  // so that Vite/esbuild can constant-fold each `if` at build time when the
  // env var is set, and dead-code-eliminate the unused dynamic imports.
  if (import.meta.env.VITE_TRYSTERO_STRATEGY === 'mqtt') {
    const m = await import('trystero/mqtt')
    return { joinRoom: m.joinRoom, selfId: m.selfId, strategy: 'mqtt' }
  }
  if (import.meta.env.VITE_TRYSTERO_STRATEGY === 'torrent') {
    const m = await import('trystero/torrent')
    return { joinRoom: m.joinRoom, selfId: m.selfId, strategy: 'torrent' }
  }
  if (
    import.meta.env.VITE_TRYSTERO_STRATEGY &&
    import.meta.env.VITE_TRYSTERO_STRATEGY !== 'nostr'
  ) {
    console.warn(
      `[room] unsupported VITE_TRYSTERO_STRATEGY=` +
        `"${import.meta.env.VITE_TRYSTERO_STRATEGY}"; ` +
        `falling back to "nostr". Supported: nostr, mqtt, torrent.`,
    )
  }
  const m = await import('trystero/nostr')
  return { joinRoom: m.joinRoom, selfId: m.selfId, strategy: 'nostr' }
}

const { joinRoom, selfId, strategy: activeStrategy } = await resolveStrategy()
console.log(`[room] active Trystero strategy: ${activeStrategy}`)

/** Parse comma-separated relay URLs from env var, or return undefined to use Trystero defaults. */
function customRelayUrls(): string[] | undefined {
  const raw = import.meta.env.VITE_TRYSTERO_RELAYS
  if (!raw) return undefined
  const urls = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (urls.length === 0) return undefined
  console.log(`[room] using custom relays (${urls.length}):`, urls)
  return urls
}

export interface RoomBinding {
  room: Room
  doc: Y.Doc
  leave: () => void
}

let syncLogCount = 0

export function joinGameRoom(gameCode: string, doc: Y.Doc): RoomBinding {
  const relayUrls = customRelayUrls()
  const room = joinRoom(
    { appId: APP_ID, password: gameCode, ...(relayUrls ? { relayUrls } : {}) },
    gameCode,
  )

  const [sendUpdate, getUpdate] = room.makeAction<Uint8Array>('y-update')
  const [sendSync, getSync] = room.makeAction<Uint8Array>('y-sync')

  console.log(
    `[room] joined "${gameCode}" as ${selfId} (strategy=${activeStrategy})`,
  )

  // Broadcast local Y updates to all peers (skip updates that came FROM the network).
  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return
    const bytes = update.byteLength
    console.log(`[room] broadcasting local update (${bytes}b, origin=${origin})`)
    sendUpdate(update)
  }
  doc.on('update', onLocalUpdate)

  // Apply remote updates.
  getUpdate((update) => {
    const bytes = (update as Uint8Array).byteLength
    console.log(`[room] received remote update (${bytes}b)`)
    Y.applyUpdate(doc, update as Uint8Array, 'remote')
  })

  // When a new peer joins, send them our full state.
  room.onPeerJoin((peerId: string) => {
    console.log(`[room] peer joined: ${peerId}`)
    const state = Y.encodeStateAsUpdate(doc)
    console.log(
      `[room] sending full sync to ${peerId} (${state.byteLength}b)`,
    )
    sendSync(state)
  })

  room.onPeerLeave((peerId: string) => {
    console.log(`[room] peer left: ${peerId}`)
  })

  getSync((state) => {
    const bytes = (state as Uint8Array).byteLength
    syncLogCount++
    console.log(`[room] received full sync #${syncLogCount} (${bytes}b)`)
    Y.applyUpdate(doc, state as Uint8Array, 'remote')
  })

  return {
    room,
    doc,
    leave: () => {
      console.log(`[room] leaving "${gameCode}"`)
      doc.off('update', onLocalUpdate)
      room.leave()
    },
  }
}

export { selfId }
export { activeStrategy }
