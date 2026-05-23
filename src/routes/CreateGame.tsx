import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { generateGameCode } from '@/game/codes'
import { GAME_NAMES_EN } from '@/assets/gameNamesEn'
import { GAME_NAMES_IT } from '@/assets/gameNamesIt'

const LIVES_MIN = 1
const LIVES_MAX = 5

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function CreateGame() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()

  const names = i18n.resolvedLanguage === 'it' ? GAME_NAMES_IT : GAME_NAMES_EN
  const [name, setName] = useState(() => pickRandom(names))
  const [startingLives, setStartingLives] = useState(3)

  const create = () => {
    const code = generateGameCode()
    sessionStorage.setItem(
      `vucciria:pending:${code}`,
      JSON.stringify({
        name: name.trim() || `Game ${code}`,
        startingLives,
        isHost: true,
      }),
    )
    nav(`/lobby/${code}`)
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4 mt-8">
      <h1 className="text-2xl text-beer-800 font-bold">{t('create.title')}</h1>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-beer-800 font-semibold">{t('create.name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          maxLength={40}
          className="px-3 py-2 rounded-lg bg-white ring-1 ring-beer-300 outline-none focus:ring-2 focus:ring-beer-600"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-beer-800 font-semibold">{t('create.startingLives')}</span>
        <div className="flex items-center gap-3">
          <span className="flex gap-0.5 text-2xl flex-1 justify-start items-center">
            {Array.from({ length: startingLives }).map((_, i) => (
              <span key={i}>🥃</span>
            ))}
          </span>
          <span className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setStartingLives((v) => Math.max(LIVES_MIN, v - 1))}
              disabled={startingLives <= LIVES_MIN}
              className="w-8 h-8 rounded-full bg-beer-600 text-white font-bold text-lg disabled:bg-beer-300 transition"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setStartingLives((v) => Math.min(LIVES_MAX, v + 1))}
              disabled={startingLives >= LIVES_MAX}
              className="w-8 h-8 rounded-full bg-beer-600 text-white font-bold text-lg disabled:bg-beer-300 transition"
            >
              +
            </button>
          </span>
        </div>
      </label>

      <button
        onClick={create}
        className="mt-2 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 text-white font-bold shadow-lg"
      >
        {t('create.submit')}
      </button>
      <button onClick={() => nav('/dashboard')} className="text-beer-700 text-sm underline">
        ← {t('create.back')}
      </button>
    </div>
  )
}
