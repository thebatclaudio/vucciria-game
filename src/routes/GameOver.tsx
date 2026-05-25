import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameRoom, useGameMeta, usePlayers } from '@/net/hooks'
import { clearGame } from '@/net/persistence'
import { forgetRecentGame } from '@/net/recentGames'
import { restartGame } from '@/game/rematch'
import NotoEmoji from '@/components/NotoEmoji'
import Scoreboard from '@/components/Scoreboard'
import Confetti from '@/components/Confetti'
import {
  PrimaryButton,
  SecondaryButton,
} from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function GameOver() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { code } = useParams<{ code: string }>()
  const binding = useGameRoom(code)
  const meta = useGameMeta(binding?.doc ?? null)
  const players = usePlayers(binding?.doc ?? null)

  const winner = players.find((p) => p.peerId === meta?.winnerPeerId)

  // Confirmation gate around "Back to dashboard" — this triggers
  // `clearGame(code)` on unmount, which wipes the IndexedDB-persisted
  // Yjs state for the room. Without a confirm step a stray tap on the
  // game-over screen permanently deletes the post-game state (which the
  // rematch flow below would otherwise want).
  const [confirmBack, setConfirmBack] = useState(false)

  // `leavingForDashboard` gates the cleanup effect: when the user picks
  // "Back to dashboard" we DO want to clear the game; when the rematch
  // flow navigates everyone to /play we DON'T (the doc must survive).
  // Default true — the legacy behaviour was always-clear-on-unmount.
  const leavingForDashboardRef = useRef(true)

  useEffect(() => {
    return () => {
      if (!leavingForDashboardRef.current) return
      if (code) {
        void clearGame(code)
        forgetRecentGame(code)
      }
    }
  }, [code])

  // Rematch listener — survivors watch for `status` flipping back to
  // `playing` (the host's restartGame writes that into meta) and follow
  // along to /play. Mark the unmount as "rematch" so the cleanup effect
  // doesn't wipe the doc out from under the new game.
  useEffect(() => {
    if (meta?.status === 'playing' && code) {
      leavingForDashboardRef.current = false
      nav(`/play/${code}`)
    }
  }, [meta?.status, code, nav])

  const onRematch = () => {
    if (!binding) return
    leavingForDashboardRef.current = false
    restartGame(binding.doc)
    // The status-watch effect above will handle the navigate once the
    // local doc applies the transact — keeps host + survivors on the
    // same code path.
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-5 mt-8 text-center">
      {/* Decorative confetti, one-shot. Skipped under reduced-motion. */}
      <Confetti />

      <h1 className="text-4xl font-bold text-ink">
        <span aria-hidden>🏆 </span>
        {t('over.title')}
      </h1>

      {winner && (
        <div className="bg-white rounded-card p-6 shadow-elev-2 flex flex-col items-center w-full">
          <NotoEmoji emoji={winner.emoji} size={112} animated />
          <p className="text-2xl font-bold text-ink mt-3">
            {t('over.winner', { name: winner.nickname })}
          </p>
        </div>
      )}

      {/* Full sorted ranking — winner first, then by lives desc. */}
      <section
        aria-labelledby="scoreboard-heading"
        className="w-full bg-white rounded-card p-3 shadow-elev-1 ring-1 ring-ink/5 flex flex-col gap-2"
      >
        <h2
          id="scoreboard-heading"
          className="text-xs font-semibold uppercase tracking-button text-ink-soft px-1 text-left"
        >
          {t('over.scoreboard')}
        </h2>
        <Scoreboard
          players={players}
          winnerPeerId={meta?.winnerPeerId ?? null}
          startingLives={meta?.startingLives ?? 3}
        />
      </section>

      <div className="w-full flex flex-col gap-2">
        <PrimaryButton onClick={onRematch} leadingIcon="🔄">
          {t('over.rematch')}
        </PrimaryButton>
        <SecondaryButton
          onClick={() => setConfirmBack(true)}
          block
          leadingIcon="←"
        >
          {t('over.backToDashboard')}
        </SecondaryButton>
      </div>

      <ConfirmDialog
        open={confirmBack}
        title={t('confirm.backToDashboard.title')}
        body={t('confirm.backToDashboard.body')}
        confirmLabel={t('confirm.backToDashboard.confirm')}
        tone="primary"
        onConfirm={() => {
          setConfirmBack(false)
          // leavingForDashboardRef stays `true` (default) so the unmount
          // cleanup wipes the doc as before.
          nav('/dashboard')
        }}
        onCancel={() => setConfirmBack(false)}
      />
    </div>
  )
}
