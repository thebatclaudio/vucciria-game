import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profile'

export default function Dashboard() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const profile = useProfileStore((s) => s.profile)!
  const clear = useProfileStore((s) => s.clearProfile)

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

      <button
        onClick={() => nav('/join')}
        className="w-full py-4 rounded-xl bg-white/90 hover:bg-white text-beer-800 text-lg font-bold ring-1 ring-beer-400 shadow transition"
      >
        🔑 {t('dashboard.joinGame')}
      </button>

      <button
        onClick={() => {
          clear()
          nav('/')
        }}
        className="mt-8 text-sm text-beer-700 underline"
      >
        {t('dashboard.changeProfile')}
      </button>
    </div>
  )
}
