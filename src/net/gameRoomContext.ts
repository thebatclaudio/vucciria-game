import { createContext } from 'react'
import type { RoomBinding } from './room'

/**
 * Shared React context exposing the live Y.Doc + Trystero binding for the
 * current game room. Mounted by `<GameRoomProvider>` (see
 * `src/net/GameRoomProvider.tsx`) and read by `useGameRoom` in
 * `src/net/hooks.ts`.
 *
 * Kept in its own module so the provider file can satisfy the
 * `react-refresh/only-export-components` rule (no non-component exports
 * alongside the component).
 */
export const GameRoomContext = createContext<RoomBinding | null>(null)
