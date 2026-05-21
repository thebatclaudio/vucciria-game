import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import Home from './routes/Home'
import Dashboard from './routes/Dashboard'
import CreateGame from './routes/CreateGame'
import JoinGame from './routes/JoinGame'
import Lobby from './routes/Lobby'
import Play from './routes/Play'
import GameOver from './routes/GameOver'
import BeerBubbles from './components/BeerBubbles'
import LanguageToggle from './components/LanguageToggle'
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
    <div className="relative min-h-screen">
      <BeerBubbles />
      <div className="fixed top-3 right-3 z-50">
        <LanguageToggle />
      </div>
      <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-6">
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
            path="/join"
            element={
              <RequireProfile>
                <JoinGame />
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
  )
}
