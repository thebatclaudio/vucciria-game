import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { getCard } from '@/game/cards'

export default function Card({ cardId }: { cardId: string | null }) {
  const { t } = useTranslation()
  if (!cardId) {
    return (
      <div className="w-64 h-96 rounded-2xl bg-beer-300/70 border-4 border-beer-600 flex items-center justify-center text-beer-800 text-7xl shadow-xl">
        🎴
      </div>
    )
  }
  const card = getCard(cardId)
  return (
    <motion.div
      key={cardId}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-64 h-96 rounded-2xl bg-white border-4 border-beer-600 p-4 flex flex-col items-center justify-between shadow-xl"
    >
      <div className="text-7xl mt-4">{card.icon}</div>
      <h2 className="text-2xl font-bold text-beer-800 text-center">
        {t(`cards.${card.id}.title`)}
      </h2>
      <p className="text-sm text-beer-900 text-center leading-snug px-2 pb-2">
        {t(`cards.${card.id}.desc`)}
      </p>
    </motion.div>
  )
}
