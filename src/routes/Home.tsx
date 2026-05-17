import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import EmojiPicker from '@/components/EmojiPicker'
import { useProfileStore } from '@/store/profile'

export default function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const existing = useProfileStore((s) => s.profile)
  const setProfile = useProfileStore((s) => s.setProfile)

  const [nickname, setNickname] = useState(existing?.nickname ?? '')
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji ?? null)

  const canPlay = nickname.trim().length >= 2 && emoji !== null

  const submit = () => {
    if (!canPlay || !emoji) return
    setProfile({ nickname: nickname.trim(), emoji })
    nav('/dashboard')
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 mt-8">
      <header className="text-center">
        <h1 className="text-5xl font-bold text-beer-800">🥃 {t('app.title')}</h1>
        <p className="text-beer-700 mt-1">{t('app.tagline')}</p>
      </header>

      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t('home.nicknamePlaceholder')}
        maxLength={20}
        className="w-full px-4 py-3 rounded-xl bg-white/90 ring-1 ring-beer-300 focus:ring-2 focus:ring-beer-600 outline-none text-lg"
      />
      {nickname.length > 0 && nickname.trim().length < 2 && (
        <p className="text-sm text-red-600 -mt-4">{t('home.nicknameTooShort')}</p>
      )}

      <EmojiPicker value={emoji} onChange={setEmoji} />

      <button
        type="button"
        onClick={submit}
        disabled={!canPlay}
        className="w-full py-4 rounded-xl bg-beer-600 hover:bg-beer-700 disabled:bg-beer-300 text-white text-lg font-bold transition shadow-lg"
      >
        {t('home.play')}
      </button>
    </div>
  )
}
