import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { joinGameRoom, type RoomBinding } from './room'
import { persistGame } from './persistence'
import {
  createGameDoc,
  getPlayers,
  getMeta,
  readMeta,
  readPlayers,
} from './ydoc'
import type { GameMeta, Player } from '@/game/types'

/**
 * Hook that joins (or rejoins) a game room by code. Returns the live
 * Yjs doc + binding. The doc is created on first call and reused.
 */
export function useGameRoom(code: string | undefined): RoomBinding | null {
  const [binding, setBinding] = useState<RoomBinding | null>(null)
  const ref = useRef<RoomBinding | null>(null)

  useEffect(() => {
    if (!code) return
    const doc = createGameDoc()
    const destroyPersistence = persistGame(code, doc)
    const b = joinGameRoom(code, doc)
    ref.current = b
    setBinding(b)
    return () => {
      destroyPersistence()
      b.leave()
      doc.destroy()
      ref.current = null
      setBinding(null)
    }
  }, [code])

  return binding
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
