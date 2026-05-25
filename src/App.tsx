import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import Home from './routes/Home'
import Dashboard from './routes/Dashboard'
import CreateGame from './routes/CreateGame'

import Lobby from './routes/Lobby'
import Play from './routes/Play'
import GameOver from './routes/GameOver'
import BeerBubbles from './components/BeerBubbles'
import BuildVersionTag from './components/BuildVersionTag'
import LanguageToggle from './components/LanguageToggle'
import PwaUpdateToast from './components/PwaUpdateToast'
import { ToastProvider } from './components/ui/Toast'
import { GameRoomProvider } from './net/GameRoomProvider'
import { useProfileStore } from './store/profile'

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useProfileStore((s) => s.profile)
  if (!profile) return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * Layout route element that owns the Y.Doc + Trystero room binding for the
 * whole lifetime of a game. Wrapping `/lobby/:code`, `/play/:code`, and
 * `/over/:code` under this layout means navigating between them does NOT
 * recreate the binding — that was the root cause of the "first turn isn't
 * synchronized" bug (see `GameRoomProvider.tsx` for the full history).
 */
function GameRoomLayout() {
  const { code } = useParams<{ code: string }>()
  if (!code) return <Navigate to="/" replace />
  return (
    <GameRoomProvider code={code}>
      <Outlet />
    </GameRoomProvider>
  )
}

export default function App() {
  return (
    // ToastProvider mounts a single global toast slot used via `useToast()`
    // anywhere in the tree. The provider must wrap the routes so route
    // components can show toasts as they unmount / navigate.
    <ToastProvider>
      <div className="relative">
        <BeerBubbles />
        {/* `<header>` landmark groups the persistent floating chrome
            (language switch, future settings) so screen-reader users
            can jump straight to it via the landmarks rotor. */}
        <header className="fixed top-3 right-3 z-50">
          <LanguageToggle />
        </header>
        <PwaUpdateToast />
        <BuildVersionTag />
        <main
          className="relative z-10 min-h-dvh flex flex-col items-center px-4 py-6"
          // iOS home-indicator inset (and notch on top via --safe-t).
          // `--safe-b` is declared on :root in src/styles/index.css.
          style={{
            paddingBottom: 'max(1.5rem, calc(1.5rem + var(--safe-b)))',
            paddingTop: 'max(1.5rem, calc(1.5rem + var(--safe-t)))',
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <RequireProfile>
                  <Dashboard />
                </RequireProfile>
              }
            />
            <Route
              path="/create"
              element={
                <RequireProfile>
                  <CreateGame />
                </RequireProfile>
              }
            />

            <Route
              element={
                <RequireProfile>
                  <GameRoomLayout />
                </RequireProfile>
              }
            >
              <Route path="/lobby/:code" element={<Lobby />} />
              <Route path="/play/:code" element={<Play />} />
              <Route path="/over/:code" element={<GameOver />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
