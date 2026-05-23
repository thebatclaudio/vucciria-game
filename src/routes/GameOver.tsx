import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameRoom, useGameMeta, usePlayers } from '@/net/hooks'
import { clearGame } from '@/net/persistence'
import NotoEmoji from '@/components/NotoEmoji'

export default function GameOver() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { code } = useParams<{ code: string }>()
  const binding = useGameRoom(code)
  const meta = useGameMeta(binding?.doc ?? null)
  const players = usePlayers(binding?.doc ?? null)

  const winner = players.find((p) => p.peerId === meta?.winnerPeerId)

  useEffect(() => {
    return () => {
      if (code) void clearGame(code)
    }
  }, [code])

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 mt-16 text-center">
      <h1 className="text-4xl font-bold text-beer-800">🏆 {t('over.title')}</h1>
      {winner && (
        <div className="bg-white/90 rounded-2xl p-8 shadow-xl flex flex-col items-center">
          <NotoEmoji emoji={winner.emoji} size={128} animated />
          <p className="text-2xl font-bold text-beer-800 mt-3">
            {t('over.winner', { name: winner.nickname })}
          </p>
        </div>
      )}
      <button
        onClick={() => nav('/dashboard')}
        className="py-3 px-6 rounded-xl bg-beer-600 hover:bg-beer-700 text-white font-bold shadow-lg"
      >
        ← {t('over.backToDashboard')}
      </button>
    </div>
  )
}
