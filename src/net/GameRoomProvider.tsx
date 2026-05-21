import { useEffect, useRef, useState, type ReactNode } from 'react'
import { joinGameRoom, type RoomBinding } from './room'
import { persistGame } from './persistence'
import { createGameDoc } from './ydoc'
import { GameRoomContext } from './gameRoomContext'

/**
 * Single source of truth for the Y.Doc + Trystero room binding that backs
 * one in-progress game (identified by `code`).
 *
 * Why this exists (regression context):
 *
 *   Previously, `<Lobby>` and `<Play>` were sibling routes in App.tsx and
 *   each route mounted its OWN `useGameRoom` hook. The hook created a
 *   fresh Y.Doc and joined a new Trystero room on mount, and destroyed
 *   them on unmount. When the host clicked "Start game" and `meta.status`
 *   flipped to 'playing', BOTH browsers navigated `/lobby/:code →
 *   /play/:code`. That triggered an unmount/remount of the room binding
 *   on BOTH peers at the exact moment the first turn began. Trystero
 *   (over MQTT) can take seconds-to-minutes to rediscover peers, so the
 *   first round of draw + end-turn updates from Browser A never reached
 *   Browser B's freshly-recreated room. The user-visible symptom: the
 *   inactive peer's screen stayed frozen until they manually refreshed.
 *
 *   This provider hoists the lifecycle ONE level above the route boundary
 *   (see `src/App.tsx`: the layout route element `<GameRoomLayout>` mounts
 *   it). The same `Y.Doc` + Trystero room are reused for the entire
 *   lobby → play (→ over) journey, so the P2P channel is never torn
 *   down at game start.
 *
 * The React context itself lives in `./gameRoomContext.ts` so this file
 * can satisfy the `react-refresh/only-export-components` rule.
 *
 * Lifecycle:
 *   - On mount (or `code` change): create doc, attach IndexedDB persistence,
 *     join the Trystero room. Expose the binding to descendants.
 *   - On unmount (or `code` change): destroy persistence binding, leave
 *     the Trystero room, destroy the doc.
 *
 * Strict-mode note: React 18 mounts effects twice in development. Since
 * this provider lives at the layout level (mounts once per game), the
 * double-invoke noise is bounded to the dev environment and the cleanup
 * function safely tears down both halves of the pair.
 */

export interface GameRoomProviderProps {
  code: string
  children?: ReactNode
}

export function GameRoomProvider({ code, children }: GameRoomProviderProps) {
  const [binding, setBinding] = useState<RoomBinding | null>(null)
  // Track the active binding via ref too, so the cleanup closure always
  // tears down the binding it created (and not a stale one from a fast
  // `code` change).
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
      if (ref.current === b) ref.current = null
      setBinding(null)
    }
  }, [code])

  return <GameRoomContext.Provider value={binding}>{children}</GameRoomContext.Provider>
}
