import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './routes/Home'
import Dashboard from './routes/Dashboard'
import CreateGame from './routes/CreateGame'
import JoinGame from './routes/JoinGame'
import Lobby from './routes/Lobby'
import Play from './routes/Play'
import GameOver from './routes/GameOver'
import BeerBubbles from './components/BeerBubbles'
import LanguageToggle from './components/LanguageToggle'
import { useProfileStore } from './store/profile'

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useProfileStore((s) => s.profile)
  if (!profile) return <Navigate to="/" replace />
  return <>{children}</>
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
            path="/lobby/:code"
            element={
              <RequireProfile>
                <Lobby />
              </RequireProfile>
            }
          />
          <Route
            path="/play/:code"
            element={
              <RequireProfile>
                <Play />
              </RequireProfile>
            }
          />
          <Route
            path="/over/:code"
            element={
              <RequireProfile>
                <GameOver />
              </RequireProfile>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
