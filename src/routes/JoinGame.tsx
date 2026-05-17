import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { isValidGameCode, normalizeGameCode } from '@/game/codes'

export default function JoinGame() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [code, setCode] = useState('')

  const submit = () => {
    if (!isValidGameCode(code)) return
    nav(`/lobby/${code}`)
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4 mt-12">
      <h1 className="text-2xl text-beer-800 font-bold">{t('join.title')}</h1>

      <input
        value={code}
        onChange={(e) => setCode(normalizeGameCode(e.target.value))}
        placeholder={t('join.codePlaceholder')}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="px-4 py-4 rounded-xl bg-white ring-1 ring-beer-300 outline-none focus:ring-2 focus:ring-beer-600 text-3xl tracking-widest text-center font-mono"
      />
      {code.length > 0 && !isValidGameCode(code) && (
        <p className="text-sm text-red-600">{t('join.invalidCode')}</p>
      )}

      <button
        onClick={submit}
        disabled={!isValidGameCode(code)}
        className="py-3 rounded-xl bg-beer-600 hover:bg-beer-700 disabled:bg-beer-300 text-white font-bold shadow-lg transition"
      >
        {t('join.submit')}
      </button>
      <button onClick={() => nav('/dashboard')} className="text-beer-700 text-sm underline">
        ← {t('join.back')}
      </button>
    </div>
  )
}
