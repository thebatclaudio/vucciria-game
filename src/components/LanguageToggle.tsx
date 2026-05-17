import { useTranslation } from 'react-i18next'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'en'
  const next = current === 'en' ? 'it' : 'en'
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      className="px-3 py-1 rounded-full bg-white/80 backdrop-blur text-beer-800 text-sm font-semibold shadow"
      aria-label={`Switch language to ${next}`}
    >
      {current === 'en' ? '🇮🇹 IT' : '🇬🇧 EN'}
    </button>
  )
}
