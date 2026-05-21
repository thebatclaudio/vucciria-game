/**
 * Regression test for the "first turn isn't synchronized" bug.
 *
 * Root cause: `<Lobby>` and `<Play>` are sibling routes in App.tsx. Each
 * mounted its own `useGameRoom` hook, which created a fresh `Y.Doc` + new
 * Trystero room binding on mount and destroyed them on unmount. When the
 * host clicked "Start game", `meta.status` flipped to 'playing' and both
 * peers navigated `/lobby/:code → /play/:code`. That triggered an
 * unmount/remount of the room binding on BOTH browsers simultaneously,
 * tearing down the P2P channel exactly when the first turn started. Until
 * Trystero re-discovered the peers (seconds-to-minutes over MQTT), the
 * draw/end-turn updates from Browser A never reached Browser B. A manual
 * refresh worked around it because by then peer discovery had settled.
 *
 * Fix: hoist the Y.Doc + Trystero room into a `GameRoomProvider` mounted
 * by a layout route that wraps both `/lobby/:code` and `/play/:code`, so
 * the binding survives the route transition.
 *
 * This test pins the contract: across a child unmount/remount under the
 * same provider+code, the binding (and underlying Y.Doc) is the SAME
 * instance; only when the provider itself unmounts does the doc get
 * destroyed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Tell React 18 we're in a test environment so `act()` is supported.
// Without this, every `act()` call logs a noisy warning to stderr.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

// Mock the room module BEFORE importing the provider so the real Trystero
// dynamic imports (which include top-level await and live MQTT brokers)
// never execute under the unit-test runner.
vi.mock('@/net/room', () => {
  return {
    joinGameRoom: (_gameCode: string, doc: unknown) => ({
      room: { getPeers: () => ({}) } as unknown,
      doc,
      leave: vi.fn(),
    }),
    selfId: 'test-self-id',
    activeStrategy: 'mqtt' as const,
  }
})

// Stub IndexedDB persistence — happy-dom does not implement IndexedDB and
// we don't want to test persistence here.
vi.mock('@/net/persistence', () => ({
  persistGame: () => () => {},
  clearGame: async () => {},
}))

import { GameRoomProvider } from '@/net/GameRoomProvider'
import { useGameRoom } from '@/net/hooks'
import type { RoomBinding } from '@/net/room'

interface CaptureProps {
  onBinding: (b: RoomBinding | null) => void
}

function Capture({ onBinding }: CaptureProps) {
  const binding = useGameRoom('TESTAB')
  useEffect(() => {
    onBinding(binding)
  }, [binding, onBinding])
  return null
}

describe('GameRoomProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('keeps the same Y.Doc across child unmount/remount under the same provider', async () => {
    const seen: (RoomBinding | null)[] = []
    const capture = (b: RoomBinding | null) => seen.push(b)

    // First render: provider + child A
    await act(async () => {
      root.render(
        <GameRoomProvider code="TESTAB">
          <Capture onBinding={capture} />
        </GameRoomProvider>,
      )
    })

    // Unmount only the child (provider stays).
    await act(async () => {
      root.render(<GameRoomProvider code="TESTAB" />)
    })

    // Remount a fresh child consumer under the same provider.
    await act(async () => {
      root.render(
        <GameRoomProvider code="TESTAB">
          <Capture onBinding={capture} />
        </GameRoomProvider>,
      )
    })

    const firstBinding = seen.find((b) => b !== null)
    const lastBinding = [...seen].reverse().find((b) => b !== null)
    expect(firstBinding).toBeTruthy()
    expect(lastBinding).toBeTruthy()
    // Same Y.Doc reference — proves the binding outlived the consumer.
    expect(lastBinding!.doc).toBe(firstBinding!.doc)

    await act(async () => {
      root.unmount()
    })
  })

  it('destroys the Y.Doc when the provider itself unmounts', async () => {
    let captured: RoomBinding | null = null
    const capture = (b: RoomBinding | null) => {
      if (b) captured = b
    }

    await act(async () => {
      root.render(
        <GameRoomProvider code="TESTAB">
          <Capture onBinding={capture} />
        </GameRoomProvider>,
      )
    })

    expect(captured).toBeTruthy()
    const doc = (captured as unknown as RoomBinding).doc
    expect(doc).toBeTruthy()

    await act(async () => {
      root.unmount()
    })

    // Y.Doc exposes `isDestroyed` as a public flag after `destroy()`.
    expect((doc as unknown as { isDestroyed: boolean }).isDestroyed).toBe(true)
  })

  it('recreates the binding when the room code changes', async () => {
    const seen: (RoomBinding | null)[] = []
    const capture = (b: RoomBinding | null) => seen.push(b)

    await act(async () => {
      root.render(
        <GameRoomProvider code="ROOM_A">
          <Capture onBinding={capture} />
        </GameRoomProvider>,
      )
    })
    const firstBinding = seen.find((b) => b !== null)!

    await act(async () => {
      root.render(
        <GameRoomProvider code="ROOM_B">
          <Capture onBinding={capture} />
        </GameRoomProvider>,
      )
    })
    const lastBinding = [...seen].reverse().find((b) => b !== null)!

    expect(lastBinding.doc).not.toBe(firstBinding.doc)

    await act(async () => {
      root.unmount()
    })
  })
})
