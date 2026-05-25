import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { getCard } from '@/game/cards'
import type { CardResolution } from '@/game/types'

type Props = {
  cardId: string | null
}

/**
 * Playing-card surface. Pure content — no longer doubles as a button. The
 * Draw / End turn affordances live in the sticky action bar at the bottom
 * of `Play.tsx`; this component just displays the drawn card and animates
 * the flip-in. Removing the dual affordance kills the "is this a button or
 * is it content?" ambiguity and lets the page CTA pattern be uniform.
 *
 * Visual additions (Phase 2):
 *
 *   ┌───────────────────────────────┐
 *   │ [TYPE]              🎴 emoji  │   ← top-left chip = card category
 *   │                               │
 *   │           ⚔️                  │
 *   │         Title                 │
 *   │      Description …            │
 *   └───────────────────────────────┘
 *
 * The chip uses semantic colors so the user can scan a card and know at a
 * glance whether it's automatic, requires a pick, etc.
 */

/**
 * Maps a `CardResolution` to a (label-key, chip-tone) pair. We split the
 * label out so i18n owns the copy and the component owns the chrome.
 * `manual` is shown with its colloquial Italian name ("Mossa") because
 * that's how players actually refer to it at the table.
 */
const TYPE_CHIP: Record<
  CardResolution,
  { i18nKey: string; classes: string; icon: string }
> = {
  auto: {
    i18nKey: 'play.cardType.auto',
    classes: 'bg-success-soft text-success ring-1 ring-success/30',
    icon: '⚡',
  },
  manual: {
    i18nKey: 'play.cardType.manual',
    classes: 'bg-warn-soft text-warn ring-1 ring-warn/30',
    icon: '🎭',
  },
  'drawer-choice': {
    i18nKey: 'play.cardType.drawerChoice',
    classes: 'bg-canvas text-ink ring-1 ring-accent/40',
    icon: '👉',
  },
  duel: {
    i18nKey: 'play.cardType.duel',
    classes: 'bg-danger-soft text-danger ring-1 ring-danger/30',
    icon: '⚔️',
  },
  'host-choice': {
    i18nKey: 'play.cardType.hostChoice',
    classes: 'bg-white text-ink ring-1 ring-ink/30',
    icon: '👑',
  },
}

export default function Card({ cardId }: Props) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()

  if (!cardId) {
    return (
      <div
        role="img"
        aria-label="Empty deck"
        className="w-64 h-96 rounded-card bg-white/40 border-[3px] border-ink/40 flex items-center justify-center text-ink text-7xl shadow-elev-1"
      >
        🎴
      </div>
    )
  }

  const card = getCard(cardId)
  const chip = TYPE_CHIP[card.effect.resolution]

  return (
    <motion.div
      key={cardId}
      initial={reduced ? { opacity: 0 } : { rotateY: 90, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
      transition={{ duration: reduced ? 0.2 : 0.5, ease: 'easeOut' }}
      className="w-64 h-96 rounded-card bg-white border-[3px] border-ink p-4 flex flex-col items-center justify-between shadow-elev-1 relative"
    >
      {/* Top-left card-type chip */}
      <span
        className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[10px] font-bold uppercase tracking-button ${chip.classes}`}
      >
        <span aria-hidden>{chip.icon}</span>
        {t(chip.i18nKey)}
      </span>

      <div className="text-7xl mt-8" aria-hidden>
        {card.icon}
      </div>
      <h2 className="text-2xl font-bold text-ink text-center">
        {t(`cards.${card.id}.title`)}
      </h2>
      <p className="text-sm text-ink-soft text-center leading-snug px-2 pb-2">
        {t(`cards.${card.id}.desc`)}
      </p>
    </motion.div>
  )
}
