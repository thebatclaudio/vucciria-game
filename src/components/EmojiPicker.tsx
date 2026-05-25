import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJIS, DEFAULT_EMOJIS } from '@/assets/emojis'
import { NO_LOTTIE } from '@/assets/notoEmojiMap'
import NotoEmoji from '@/components/NotoEmoji'
import ModalShell from '@/components/ui/ModalShell'
import { SecondaryButton } from '@/components/ui/Button'

/**
 * Avatar picker — bottom-sheet dialog on mobile, centered modal on desktop.
 *
 * Phase 2.6 refactor: previously this rendered inline beneath the Home
 * nickname row, which pushed the Play CTA below the fold whenever it
 * was open. Routing through `<ModalShell>` matches the player-picker /
 * confirm dialog patterns, lets us drop the `pointer-events-none/auto`
 * overlay hack in Home, and gives us focus management + a11y for free.
 */

type Props = {
  open: boolean
  value: string | null
  onChange: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ open, value, onChange, onClose }: Props) {
  const { t } = useTranslation()
  // Filter to emojis we have an animated SVG/Lottie for so the grid stays
  // visually consistent (no flat unicode glyphs).
  const animatedEmojis = useMemo(
    () => EMOJIS.filter((e) => !NO_LOTTIE.has(e)),
    [],
  )

  const onPick = (e: string) => {
    onChange(e)
    onClose()
  }

  const onRandom = () => {
    const e = DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)]
    onPick(e)
  }

  return (
    <ModalShell open={open} onDismiss={onClose} labelledBy="emoji-picker-title">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="emoji-picker-title"
          className="text-xl font-bold text-ink"
        >
          {t('home.pickEmoji')}
        </h2>
        <SecondaryButton
          onClick={onRandom}
          className="h-9 text-xs px-3"
          aria-label={t('home.randomEmoji')}
        >
          🎲 {t('home.randomEmoji')}
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-8 gap-1 overflow-y-auto p-2 bg-canvas/30 rounded-surface ring-1 ring-ink/15">
        {animatedEmojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className={`flex items-center justify-center p-1 rounded-tile transition min-w-11 min-h-11 ${
              value === e
                ? 'bg-canvas ring-2 ring-ink'
                : 'hover:bg-canvas/60 focus:bg-canvas/60'
            }`}
            // The raw glyph isn't a useful screen-reader label, but each
            // option still needs to be distinguishable. Pair `aria-label`
            // with the position so AT users can navigate the grid.
            aria-label={t('home.avatarOption')}
            aria-pressed={value === e}
          >
            <NotoEmoji emoji={e} size={28} />
          </button>
        ))}
      </div>
    </ModalShell>
  )
}
