import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profile'
import { isValidGameCode, normalizeGameCode } from '@/game/codes'
import NotoEmoji from '@/components/NotoEmoji'
import {
  PrimaryButton,
  SecondaryButton,
  LinkButton,
} from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  listRecentGames,
  forgetRecentGame,
  type RecentGame,
} from '@/net/recentGames'

export default function Dashboard() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const profile = useProfileStore((s) => s.profile)!
  const clear = useProfileStore((s) => s.clearProfile)
  const [code, setCode] = useState('')
  // Confirmation gate around "Change profile". This action wipes the
  // local profile and bounces the user back to the welcome screen — a
  // single-tap is too easy to trigger by mistake.
  const [confirmClear, setConfirmClear] = useState(false)
  // Recent games are persisted in localStorage (see net/recentGames.ts).
  // We snapshot on mount; rejoining navigates away anyway so there's no
  // need to subscribe to the storage event.
  const [recent, setRecent] = useState<RecentGame[]>(() => listRecentGames())

  // Defensive re-snapshot on focus return: another tab might have
  // recorded / forgotten a game while this one was hidden.
  useEffect(() => {
    const onFocus = () => setRecent(listRecentGames())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const dropRecent = (gameCode: string) => {
    forgetRecentGame(gameCode)
    setRecent(listRecentGames())
  }

  const submit = () => {
    if (!isValidGameCode(code)) return
    nav(`/lobby/${code}`)
  }

  const onConfirmClear = () => {
    setConfirmClear(false)
    clear()
    nav('/')
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 mt-12">
      <div className="flex flex-col items-center gap-2">
        <NotoEmoji emoji={profile.emoji} size={48} animated />
        <p className="text-2xl font-bold text-ink">{profile.nickname}</p>
        <LinkButton onClick={() => setConfirmClear(true)}>
          {t('dashboard.changeProfile')}
        </LinkButton>
      </div>

      <PrimaryButton onClick={() => nav('/create')} leadingIcon="🍻">
        {t('dashboard.createGame')}
      </PrimaryButton>

      <hr className="w-full border-ink/15" />

      {/* Join section.
          --------------
          Stacked layout: section heading → code input (full-width,
          tall) → Join CTA below (full-width primary pill, mirrors the
          shape of the "Create game" button above the divider). This is
          the same vertical-stack pattern the Create flow uses, so the
          two paths (create / join) read as visually parallel choices.

          The previous side-by-side `[ code ][ Join ]` layout was
          cramped on mobile — the input had to shrink with `flex-1`
          while the Join button competed for the remaining 6–10 chars
          of width, and the Join button shared a row with a full-width
          monospaced code field that already drew the eye. Now the
          input gets the full row and the CTA gets full prominence
          underneath. */}
      <div className="w-full flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-button text-ink-soft">
          {t('join.title')}
        </p>
        <input
          value={code}
          onChange={(e) => setCode(normalizeGameCode(e.target.value))}
          placeholder={t('join.codePlaceholder')}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full h-14 px-4 rounded-surface bg-white ring-1 ring-ink/15 outline-none focus:ring-2 focus:ring-ink text-2xl tracking-[0.4em] text-center font-mono text-ink placeholder:text-ink-faint shadow-elev-1"
        />
        {code.length > 0 && !isValidGameCode(code) && (
          <p className="text-sm text-danger">{t('join.invalidCode')}</p>
        )}
        <PrimaryButton
          onClick={submit}
          disabled={!isValidGameCode(code)}
        >
          {t('join.submit')}
        </PrimaryButton>
      </div>

      {/* Recent games — surfaces rooms this device has previously bound
          to, so reconnecting after a refresh / kick / network blip is a
          single tap. Hidden entirely when empty so first-time users
          don't see a useless empty card. */}
      {recent.length > 0 && (
        <section
          aria-labelledby="dashboard-recent-heading"
          className="w-full bg-white rounded-card p-3 shadow-elev-1 ring-1 ring-ink/5 flex flex-col gap-2"
        >
          <h2
            id="dashboard-recent-heading"
            className="text-xs font-semibold uppercase tracking-button text-ink-soft px-1"
          >
            {t('dashboard.recent')}
          </h2>
          <ul className="flex flex-col gap-2">
            {recent.slice(0, 3).map((g) => (
              <li
                key={g.code}
                className="flex items-center justify-between gap-2 bg-canvas/30 rounded-surface px-3 py-2"
              >
                <span className="flex flex-col min-w-0">
                  <span className="font-semibold text-ink truncate">
                    {g.name || t('lobby.title')}
                  </span>
                  <span className="text-[11px] font-mono tracking-widest text-ink-soft">
                    {g.code}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <SecondaryButton
                    onClick={() => nav(`/lobby/${g.code}`)}
                    className="h-9 text-xs px-3"
                  >
                    {t('dashboard.rejoin')}
                  </SecondaryButton>
                  <LinkButton
                    onClick={() => dropRecent(g.code)}
                    aria-label={t('dashboard.forget')}
                    className="!text-ink-faint hover:!text-danger text-xs"
                  >
                    ×
                  </LinkButton>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={t('confirm.clearProfile.title')}
        body={t('confirm.clearProfile.body')}
        confirmLabel={t('confirm.clearProfile.confirm')}
        onConfirm={onConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
