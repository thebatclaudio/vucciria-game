import { joinRoom, selfId, type Room } from 'trystero'
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
 * You can override the default Nostr relay list via the environment variable:
 *   VITE_TRYSTERO_RELAYS=wss://relay1.example.com,wss://relay2.example.com
 */

const APP_ID = 'vucciria-game-v2'

/** Parse comma-separated relay URLs from env var, or return undefined to use Trystero defaults. */
function customRelayUrls(): string[] | undefined {
  const raw = import.meta.env.VITE_TRYSTERO_RELAYS as string | undefined
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

  console.log(`[room] joined "${gameCode}" as ${selfId}`)

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
