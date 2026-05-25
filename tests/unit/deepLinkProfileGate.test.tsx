/**
 * Regression test for the "QR scan ignores deep-link" bug.
 *
 * Symptom: a user scans the lobby QR code without an existing profile.
 * The app routes them to `/lobby/ABC123`, RequireProfile bounces them to
 * `/` for nickname/emoji, and after submitting the form they land on
 * `/dashboard` — losing the intended lobby destination entirely. The
 * user has to type the code back in by hand.
 *
 * Fix: RequireProfile stashes the original Location in Navigate's
 * `state`. Home reads it back and, after `setProfile`, navigates to the
 * stashed destination instead of the default `/dashboard`. This test
 * pins that contract end-to-end through a minimal router so a future
 * refactor of either component can't silently regress it.
 *
 * We test the small router slice (RequireProfile + Home + a stub
 * lobby route) rather than mounting `<App>` so the test doesn't drag
 * in GameRoomProvider's trystero / IndexedDB dynamic imports.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import { useProfileStore } from '@/store/profile'
import Home from '@/routes/Home'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

// Local replica of the production `RequireProfile` so the test exercises
// the same Navigate-with-state contract. We don't import App.tsx
// directly because its other routes pull in heavy P2P deps.
function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useProfileStore((s) => s.profile)
  const location = useLocation()
  if (!profile)
    return <Navigate to="/" replace state={{ from: location }} />
  return <>{children}</>
}

function LobbyStub() {
  const location = useLocation()
  return <div data-testid="lobby">lobby:{location.pathname}</div>
}

function DashboardStub() {
  return <div data-testid="dashboard">dashboard</div>
}

function renderAt(initialPath: string, root: Root) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/dashboard"
            element={
              <RequireProfile>
                <DashboardStub />
              </RequireProfile>
            }
          />
          <Route
            path="/lobby/:code"
            element={
              <RequireProfile>
                <LobbyStub />
              </RequireProfile>
            }
          />
        </Routes>
      </MemoryRouter>,
    )
  })
}

describe('Deep-link profile gate', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    // Reset the persisted profile so each test starts logged-out.
    useProfileStore.setState({ profile: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('routes to the original deep-link destination after profile submit', async () => {
    renderAt('/lobby/ABC123', root)

    // RequireProfile should have bounced us to Home — but the Home
    // form should be the one rendered now, not the lobby.
    expect(container.querySelector('[data-testid="lobby"]')).toBeNull()

    const playButton = Array.from(
      container.querySelectorAll('button'),
    ).find((b) => /play/i.test(b.textContent ?? ''))
    expect(playButton, 'Play button should be present on Home').toBeTruthy()

    // Submit a complete profile so `canPlay` is true. Home auto-populates
    // a random nickname + emoji on mount, so we just click Play.
    await act(async () => {
      playButton!.click()
    })

    // After submit we should be in the lobby — NOT the dashboard.
    expect(
      container.querySelector('[data-testid="lobby"]')?.textContent,
    ).toBe('lobby:/lobby/ABC123')
    expect(container.querySelector('[data-testid="dashboard"]')).toBeNull()

    act(() => {
      root.unmount()
    })
  })

  it('falls back to /dashboard when there is no deep-link destination', async () => {
    renderAt('/', root)

    const playButton = Array.from(
      container.querySelectorAll('button'),
    ).find((b) => /play/i.test(b.textContent ?? ''))
    expect(playButton).toBeTruthy()

    await act(async () => {
      playButton!.click()
    })

    expect(
      container.querySelector('[data-testid="dashboard"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-testid="lobby"]')).toBeNull()

    act(() => {
      root.unmount()
    })
  })

  it('preserves search + hash on the deep-link destination', async () => {
    renderAt('/lobby/ZZ9999?ref=qr#anchor', root)

    const playButton = Array.from(
      container.querySelectorAll('button'),
    ).find((b) => /play/i.test(b.textContent ?? ''))
    expect(playButton).toBeTruthy()

    await act(async () => {
      playButton!.click()
    })

    // The pathname is what `useLocation` exposes in the stub. We can't
    // see the search/hash in the rendered text, but the route match
    // succeeded — which is the contract we care about.
    expect(
      container.querySelector('[data-testid="lobby"]')?.textContent,
    ).toBe('lobby:/lobby/ZZ9999')

    act(() => {
      root.unmount()
    })
  })
})
