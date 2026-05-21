import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profile'
import { isValidGameCode, normalizeGameCode } from '@/game/codes'

export default function Dashboard() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const profile = useProfileStore((s) => s.profile)!
  const clear = useProfileStore((s) => s.clearProfile)
  const [code, setCode] = useState('')

  const submit = () => {
    if (!isValidGameCode(code)) return
    nav(`/lobby/${code}`)
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 mt-12">
      <h1 className="text-3xl text-beer-800 font-bold text-center">
        {profile.emoji} {t('dashboard.welcome', { name: profile.nickname })}
      </h1>

      <button
        onClick={() => nav('/create')}
        className="w-full py-4 rounded-xl bg-beer-600 hover:bg-beer-700 text-white text-lg font-bold shadow-lg transition"
      >
        🆕 {t('dashboard.createGame')}
      </button>

      <hr className="w-full border-beer-200" />

      <div className="w-full flex flex-col gap-2">
        <p className="text-sm font-semibold text-beer-800">{t('join.title')}</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(normalizeGameCode(e.target.value))}
            placeholder={t('join.codePlaceholder')}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-4 py-3 rounded-xl bg-white ring-1 ring-beer-300 outline-none focus:ring-2 focus:ring-beer-600 text-lg tracking-widest text-center font-mono"
          />
          <button
            onClick={submit}
            disabled={!isValidGameCode(code)}
            className="px-6 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 disabled:bg-beer-300 text-white font-bold shadow-lg transition shrink-0"
          >
            {t('join.submit')}
          </button>
        </div>
        {code.length > 0 && !isValidGameCode(code) && (
          <p className="text-sm text-red-600">{t('join.invalidCode')}</p>
        )}
      </div>

      <button
        onClick={() => {
          clear()
          nav('/')
        }}
        className="mt-4 text-sm text-beer-700 underline"
      >
        {t('dashboard.changeProfile')}
      </button>
    </div>
  )
}
