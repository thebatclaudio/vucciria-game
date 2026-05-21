import { useContext, useEffect, useState } from 'react'
import * as Y from 'yjs'
import type { RoomBinding } from './room'
import { GameRoomContext } from './gameRoomContext'
import {
  getPlayers,
  getMeta,
  readMeta,
  readPlayers,
} from './ydoc'
import type { GameMeta, Player } from '@/game/types'

/**
 * Returns the live Yjs doc + Trystero binding for the current game.
 *
 * Reads from `GameRoomContext`, which is owned by the layout-level
 * `<GameRoomProvider>` in `src/App.tsx`. The signature still takes the
 * `code` parameter for backwards compatibility with call sites and as
 * self-documentation at the use site, but the binding is determined by
 * the surrounding provider, not by the argument.
 *
 * Returns `null` if the provider hasn't constructed the binding yet, or
 * if this hook is called outside the provider tree (e.g. on a route that
 * intentionally does not run in a game room).
 *
 * See `src/net/GameRoomProvider.tsx` for the rationale behind hoisting
 * the binding above the route boundary (the "first turn isn't
 * synchronized" bug).
 */
export function useGameRoom(_code?: string | undefined): RoomBinding | null {
  return useContext(GameRoomContext)
}

/** Subscribe to the shared meta map. */
export function useGameMeta(doc: Y.Doc | null): Partial<GameMeta> | null {
  const [meta, setMeta] = useState<Partial<GameMeta> | null>(null)
  useEffect(() => {
    if (!doc) {
      setMeta(null)
      return
    }
    const m = getMeta(doc)
    const update = () => setMeta(readMeta(doc))
    update()
    m.observe(update)
    return () => m.unobserve(update)
  }, [doc])
  return meta
}

/** Subscribe to the shared players map. */
export function usePlayers(doc: Y.Doc | null): Player[] {
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(() => {
    if (!doc) {
      setPlayers([])
      return
    }
    const p = getPlayers(doc)
    const update = () => setPlayers(readPlayers(doc))
    update()
    p.observeDeep(update)
    return () => p.unobserveDeep(update)
  }, [doc])
  return players
}

/**
 * Poll the Trystero room's peer map for a visual connection indicator.
 *
 * We poll instead of subscribing to onPeerJoin/onPeerLeave because those
 * Trystero APIs are single-assignment and would conflict with the internal
 * handlers in joinGameRoom.
 */
export function usePeerCount(room: RoomBinding['room'] | null): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!room) {
      setCount(0)
      return
    }
    const poll = () => setCount(Object.keys(room.getPeers()).length)
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [room])
  return count
}
