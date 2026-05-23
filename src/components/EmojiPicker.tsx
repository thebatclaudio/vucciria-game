import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJIS } from '@/assets/emojis'
import { NO_LOTTIE } from '@/assets/notoEmojiMap'
import NotoEmoji from '@/components/NotoEmoji'

export default function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (emoji: string) => void
}) {
  const { t } = useTranslation()
  const animatedEmojis = useMemo(() => EMOJIS.filter((e) => !NO_LOTTIE.has(e)), [])

  return (
    <div className="w-full max-w-md">
      <h2 className="font-semibold text-beer-800 mb-2">{t('home.pickEmoji')}</h2>
      <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto p-2 bg-white/70 rounded-lg ring-1 ring-beer-300">
        {animatedEmojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={`flex items-center justify-center p-1 rounded transition ${
              value === e ? 'bg-beer-300 ring-2 ring-beer-600' : 'hover:bg-beer-100'
            }`}
            aria-label={`Pick ${e}`}
          >
            {/* Static SVG per UX spec — the grid stays calm; only the chosen
                avatar comes alive elsewhere in the app. */}
            <NotoEmoji emoji={e} size={28} />
          </button>
        ))}
      </div>
    </div>
  )
}
