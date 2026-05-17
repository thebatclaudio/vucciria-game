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
 */

const APP_ID = 'vucciria-game-v2'

export interface RoomBinding {
  room: Room
  doc: Y.Doc
  leave: () => void
}

export function joinGameRoom(gameCode: string, doc: Y.Doc): RoomBinding {
  const room = joinRoom({ appId: APP_ID, password: gameCode }, gameCode)

  const [sendUpdate, getUpdate] = room.makeAction<Uint8Array>('y-update')
  const [sendSync, getSync] = room.makeAction<Uint8Array>('y-sync')

  // Broadcast local Y updates to all peers (skip updates that came FROM the network).
  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return
    sendUpdate(update)
  }
  doc.on('update', onLocalUpdate)

  // Apply remote updates.
  getUpdate((update) => {
    Y.applyUpdate(doc, update as Uint8Array, 'remote')
  })

  // When a new peer joins, send them our full state.
  room.onPeerJoin(() => {
    const state = Y.encodeStateAsUpdate(doc)
    sendSync(state)
  })

  getSync((state) => {
    Y.applyUpdate(doc, state as Uint8Array, 'remote')
  })

  return {
    room,
    doc,
    leave: () => {
      doc.off('update', onLocalUpdate)
      room.leave()
    },
  }
}

export { selfId }
