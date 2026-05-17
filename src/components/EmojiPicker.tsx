import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJIS, shuffleEmojis } from '@/assets/emojis'

export default function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (emoji: string) => void
}) {
  const { t } = useTranslation()
  const [seed, setSeed] = useState(0)
  const list = useMemo(() => (seed === 0 ? [...EMOJIS] : shuffleEmojis(EMOJIS)), [seed])

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-beer-800">{t('home.pickEmoji')}</h2>
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="px-3 py-1 text-sm rounded-full bg-beer-500 text-white hover:bg-beer-600 transition"
        >
          🔀 {t('home.shuffle')}
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto p-2 bg-white/70 rounded-lg ring-1 ring-beer-300">
        {list.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={`text-2xl p-1 rounded transition ${
              value === e ? 'bg-beer-300 ring-2 ring-beer-600' : 'hover:bg-beer-100'
            }`}
            aria-label={`Pick ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
