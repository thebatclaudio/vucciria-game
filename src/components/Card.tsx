import { motion } from 'framer-motion'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getCard } from '@/game/cards'

type Props = {
  cardId: string | null
  /**
   * When provided, the card becomes a button: pointer cursor, hover/focus
   * styles, Enter/Space activate, and a short CTA hint is shown below.
   * Pass `null` (or omit) to render a non-interactive card.
   */
  onClick?: (() => void) | null
  /** Short label shown under the card when interactive (e.g. "Tap to end turn"). */
  ctaLabel?: string | null
}

export default function Card({ cardId, onClick, ctaLabel }: Props) {
  const { t } = useTranslation()
  const interactive = typeof onClick === 'function'

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  if (!cardId) {
    return (
      <div className="w-64 h-96 rounded-2xl bg-beer-300/70 border-4 border-beer-600 flex items-center justify-center text-beer-800 text-7xl shadow-xl">
        🎴
      </div>
    )
  }

  const card = getCard(cardId)

  const interactiveProps = interactive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => onClick?.(),
        onKeyDown: handleKey,
        'aria-label': ctaLabel ?? t('play.card.cta.activate', { defaultValue: 'Activate card' }),
      }
    : {}

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        key={cardId}
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        whileHover={interactive ? { scale: 1.03 } : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`w-64 h-96 rounded-2xl bg-white border-4 border-beer-600 p-4 flex flex-col items-center justify-between shadow-xl
          ${
            interactive
              ? 'cursor-pointer hover:border-beer-700 focus:outline-none focus:ring-4 focus:ring-beer-400'
              : ''
          }`}
        {...interactiveProps}
      >
        <div className="text-7xl mt-4">{card.icon}</div>
        <h2 className="text-2xl font-bold text-beer-800 text-center">
          {t(`cards.${card.id}.title`)}
        </h2>
        <p className="text-sm text-beer-900 text-center leading-snug px-2 pb-2">
          {t(`cards.${card.id}.desc`)}
        </p>
      </motion.div>
      {interactive && ctaLabel && (
        <p className="text-xs text-beer-700 italic animate-pulse">{ctaLabel}</p>
      )}
    </div>
  )
}
