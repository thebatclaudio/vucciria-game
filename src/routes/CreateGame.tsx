import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { generateGameCode } from '@/game/codes'
import { GAME_NAMES_EN } from '@/assets/gameNamesEn'
import { GAME_NAMES_IT } from '@/assets/gameNamesIt'
import { LifeRow } from '@/components/LifeGlass'
import { PrimaryButton, LinkButton } from '@/components/ui/Button'
import Stepper from '@/components/ui/Stepper'

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
    <div className="w-full max-w-md flex flex-col gap-5 mt-8">
      <h1 className="text-2xl text-ink font-bold">{t('create.title')}</h1>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft font-semibold uppercase tracking-button">
          {t('create.name')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          maxLength={40}
          className="px-3 py-3 rounded-surface bg-white ring-1 ring-ink/15 outline-none focus:ring-2 focus:ring-ink text-ink placeholder:text-ink-faint shadow-elev-1"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-ink-soft font-semibold uppercase tracking-button">
          {t('create.startingLives')}
        </span>
        <div className="bg-white rounded-surface px-4 py-3 ring-1 ring-ink/10 shadow-elev-1">
          {/* Layout: [−]  🥃 🥃 🥃 🥃 🥃  [+]
              The LifeRow is the visible read-out (anchored against `max`
              so the row keeps its width as the user steps up/down) and
              sits inside the Stepper between the two circular buttons. */}
          <Stepper
            value={startingLives}
            min={LIVES_MIN}
            max={LIVES_MAX}
            onChange={setStartingLives}
            valueLabel={startingLives === 1 ? 'life' : 'lives'}
            ariaLabel={t('create.startingLives')}
          >
            <LifeRow lives={startingLives} max={LIVES_MAX} />
          </Stepper>
        </div>
      </div>

      <PrimaryButton onClick={create} className="mt-2">
        {t('create.submit')}
      </PrimaryButton>
      <div className="flex justify-center">
        <LinkButton onClick={() => nav('/dashboard')} leadingIcon="←">
          {t('create.back')}
        </LinkButton>
      </div>
    </div>
  )
}
