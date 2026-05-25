import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import EmojiPicker from '@/components/EmojiPicker'
import NotoEmoji from '@/components/NotoEmoji'
import { PrimaryButton } from '@/components/ui/Button'
import { useProfileStore } from '@/store/profile'
import { DEFAULT_EMOJIS } from '@/assets/emojis'

const DRINK_USERNAMES = [
  'CaptainMojito', 'SirGuzzler', 'BoozeHound', 'TheLastSpritz',
  'WhiskyTsunami', 'GinFizzical', 'RumAndRaucous', 'TequilaMockingbird',
  'VodkaVixen', 'PunchDrunk', 'AbsintheMind', 'MeadMaestro',
  'BourbonBaron', 'SakeSamurai', 'CiderSinner', 'DaiquiriDiva',
  'NegroniNinja', 'MaiTaiGuy', 'PinaColadaPirate', 'SangriaSoul',
  'BelliniBabe', 'AmarettoAmigo', 'GrappaGrande', 'LimoncelloLegend',
  'AperolSpritzLord', 'MulledWineMaverick', 'ChampagneChampion',
  'StoutStorm', 'PorterPower', 'LagerLord',
]

function pickRandomNickname(): string {
  return DRINK_USERNAMES[Math.floor(Math.random() * DRINK_USERNAMES.length)]
}

export default function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const existing = useProfileStore((s) => s.profile)
  const setProfile = useProfileStore((s) => s.setProfile)

  const [nickname, setNickname] = useState(existing?.nickname ?? '')
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji ?? null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const canPlay = nickname.trim().length >= 2 && emoji !== null

  useEffect(() => {
    if (!existing) {
      // Random default uses only faces/animals/creatures so first-time
      // players land on an identity-shaped avatar. The manual picker
      // (EmojiPicker) still exposes the full catalog.
      setEmoji(
        DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)],
      )
      setNickname(pickRandomNickname())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = () => {
    if (!canPlay || !emoji) return
    setProfile({ nickname: nickname.trim(), emoji })
    nav('/dashboard')
  }

  // Phase 2.6: the EmojiPicker is now a dialog (ModalShell), so the old
  // `fixed inset-0 / pointer-events-none` overlay trick is gone. Home
  // can rely on `<main>`'s normal flex centering — we just center our
  // own column on the viewport with `min-h-[calc(100dvh-...)]` so the
  // logo + form sit vertically centered even on tall screens.
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 mt-auto mb-auto">
      <header className="text-center flex flex-col items-center">
        {/* Original PWA logo (`vucciria-game-pwa/assets/vucciria-game-logo.png`,
            336×145 transparent PNG, ~38 KB). Served from /public so Vite copies
            it through under the configured `base` at build time. `h1` kept for
            a11y / SEO — visually hidden so the logo carries the brand.

            `loading="eager"` + `fetchPriority="high"`: this is the LCP element
            on the landing route, and skipping the lazy attribute shaves the
            first-paint visible content. The width/height attrs reserve the
            box so the layout doesn't jump while the image loads. */}
        <img
          src={`${import.meta.env.BASE_URL}vucciria-game-logo.png`}
          alt={t('app.title')}
          width={336}
          height={145}
          className="w-72 h-auto max-w-full drop-shadow"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <h1 className="sr-only">{t('app.title')}</h1>
      </header>

      {/* Identity row: avatar + nickname input + dice all share the same
          flex row and the same `h-14` so their vertical centres line up
          exactly. The status row (validation + counter) is a separate
          sibling below — keeping it out of this row was the alignment
          fix in commit X (otherwise the input column was taller than
          the avatar and items-center pulled the input ~6px above the
          avatar's midpoint). */}
      <div className="w-full flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={t('home.pickEmoji')}
            className="text-3xl w-14 h-14 flex items-center justify-center rounded-surface bg-white ring-1 ring-ink/15 hover:ring-2 hover:ring-ink transition shrink-0 shadow-elev-1 relative"
          >
            {emoji ? <NotoEmoji emoji={emoji} size={40} animated /> : '?'}
            {/* Pencil overlay signals the emoji button is editable. Without
                it, the button reads as just an avatar display. */}
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-[10px] flex items-center justify-center ring-2 ring-canvas"
            >
              ✎
            </span>
          </button>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('home.nicknamePlaceholder')}
            maxLength={20}
            className="flex-1 min-w-0 h-14 px-4 rounded-surface bg-white ring-1 ring-ink/15 focus:ring-2 focus:ring-ink outline-none text-lg text-ink placeholder:text-ink-faint shadow-elev-1"
          />
          <button
            type="button"
            onClick={() => setNickname(pickRandomNickname())}
            aria-label={t('home.randomNickname')}
            className="w-14 h-14 rounded-surface bg-white ring-1 ring-ink/15 hover:ring-2 hover:ring-ink shadow-elev-1 transition flex items-center justify-center text-xl shrink-0"
          >
            🎲
          </button>
        </div>
        <div className="flex justify-between px-1 min-h-4">
          {nickname.length > 0 && nickname.trim().length < 2 ? (
            <p className="text-xs text-danger">
              {t('home.nicknameTooShort')}
            </p>
          ) : (
            <span />
          )}
          <p
            className={`text-[11px] tabular-nums ${
              nickname.length >= 18 ? 'text-warn' : 'text-ink-faint'
            }`}
            aria-live="polite"
          >
            {nickname.length}/20
          </p>
        </div>
      </div>

      <PrimaryButton onClick={submit} disabled={!canPlay}>
        {t('home.play')}
      </PrimaryButton>

      <EmojiPicker
        open={pickerOpen}
        value={emoji}
        onChange={(e) => setEmoji(e)}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
