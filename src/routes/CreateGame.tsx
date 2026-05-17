import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { generateGameCode } from '@/game/codes'

export default function CreateGame() {
  const { t } = useTranslation()
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [startingLives, setStartingLives] = useState(3)
  const [location, setLocation] = useState('')

  const create = () => {
    const code = generateGameCode()
    // Stash desired settings for the Lobby to initialize the Y.Doc.
    sessionStorage.setItem(
      `vucciria:pending:${code}`,
      JSON.stringify({
        name: name.trim() || `Game ${code}`,
        maxPlayers,
        startingLives,
        location: location.trim() || null,
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
        <span className="text-sm text-beer-800 font-semibold">
          {t('create.maxPlayers')}: {maxPlayers}
        </span>
        <input
          type="range"
          min={2}
          max={10}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="accent-beer-600"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-beer-800 font-semibold">
          {t('create.startingLives')}: {startingLives} 🥃
        </span>
        <input
          type="range"
          min={1}
          max={5}
          value={startingLives}
          onChange={(e) => setStartingLives(Number(e.target.value))}
          className="accent-beer-600"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-beer-800 font-semibold">{t('create.location')}</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('create.locationPlaceholder')}
          maxLength={60}
          className="px-3 py-2 rounded-lg bg-white ring-1 ring-beer-300 outline-none focus:ring-2 focus:ring-beer-600"
        />
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
