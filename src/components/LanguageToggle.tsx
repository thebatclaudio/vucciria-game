import { useTranslation } from 'react-i18next'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'en'
  const next = current === 'en' ? 'it' : 'en'
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      className="min-h-11 px-3 py-1 rounded-chip bg-white/85 backdrop-blur text-ink text-sm font-semibold shadow-elev-1 ring-1 ring-ink/10 hover:bg-white transition"
      aria-label={`Switch language to ${next}`}
    >
      {current === 'en' ? '🇮🇹 IT' : '🇬🇧 EN'}
    </button>
  )
}
