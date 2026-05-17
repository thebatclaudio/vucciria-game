import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '@/components/Card'
import PlayerCircle from '@/components/PlayerCircle'
import { useGameRoom, useGameMeta, usePlayers } from '@/net/hooks'
import { getMeta, getDeck, getPlayers } from '@/net/ydoc'
import { drawNext } from '@/game/deck'
import { orderedPlayers, nextTurnSeat, checkWinner } from '@/game/rules'
import { getOrCreatePlayerId } from '@/game/identity'

export default function Play() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { code } = useParams<{ code: string }>()
  const binding = useGameRoom(code)
  const meta = useGameMeta(binding?.doc ?? null)
  const players = usePlayers(binding?.doc ?? null)

  // Stable per-tab player id (must match the one used in Lobby).
  const playerId = useMemo(() => (code ? getOrCreatePlayerId(code) : null), [code])

  const ordered = orderedPlayers(players)
  const me = ordered.find((p) => p.peerId === playerId) ?? null
  const isHost = meta?.hostPeerId === playerId
  const isMyTurn = me?.seat === meta?.turnSeat && (me?.lives ?? 0) > 0

  // Watch for game over.
  useEffect(() => {
    if (!binding || meta?.status !== 'playing') return
    const winner = checkWinner(players)
    if (winner) {
      binding.doc.transact(() => {
        getMeta(binding.doc).set('status', 'over')
        getMeta(binding.doc).set('winnerPeerId', winner.peerId)
      })
    }
  }, [binding, players, meta?.status])

  useEffect(() => {
    if (meta?.status === 'over' && code) nav(`/over/${code}`)
  }, [meta?.status, code, nav])

  const draw = () => {
    if (!binding || !isMyTurn) return
    const m = getMeta(binding.doc)
    const deck = getDeck(binding.doc)
    const currentIndex = (m.get('deckIndex') as number) ?? 0
    const seed = ((m.get('createdAt') as number) ?? Date.now()) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(deck.toArray(), currentIndex, seed)
    binding.doc.transact(() => {
      m.set('lastCardId', cardId)
      if (nextDeck !== deck.toArray()) {
        deck.delete(0, deck.length)
        deck.insert(0, nextDeck)
      }
      m.set('deckIndex', nextIndex)
    })
  }

  const endTurn = () => {
    if (!binding || !isMyTurn) return
    const m = getMeta(binding.doc)
    const next = nextTurnSeat(players, meta?.turnSeat ?? 0)
    m.set('turnSeat', next)
    m.set('lastCardId', null)
  }

  const adjustLife = (peerId: string, delta: number) => {
    if (!binding || !isHost) return
    const playersMap = getPlayers(binding.doc)
    const pm = playersMap.get(peerId)
    if (!pm) return
    const cur = (pm.get('lives') as number) ?? 0
    pm.set('lives', Math.max(0, cur + delta))
  }

  const kick = (peerId: string) => {
    if (!binding || !isHost) return
    getPlayers(binding.doc).delete(peerId)
  }

  if (!code || !meta) return null

  const currentPlayer = ordered.find((p) => p.seat === meta.turnSeat)

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4 mt-4">
      <PlayerCircle
        players={ordered}
        currentSeat={meta.turnSeat ?? 0}
        hostPeerId={meta.hostPeerId ?? ''}
        selfPeerId={playerId ?? ''}
        startingLives={meta.startingLives ?? 3}
      />

      <div className="text-center">
        <p className="text-beer-800 font-semibold">
          {isMyTurn
            ? `🎯 ${t('play.yourTurn')}`
            : t('play.turnOf', { name: currentPlayer?.nickname ?? '?' })}
        </p>
      </div>

      <Card cardId={meta.lastCardId ?? null} />

      <div className="flex gap-3">
        {isMyTurn && !meta.lastCardId && (
          <button
            onClick={draw}
            className="px-6 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 text-white font-bold shadow-lg"
          >
            🎴 {t('play.draw')}
          </button>
        )}
        {isMyTurn && meta.lastCardId && (
          <button
            onClick={endTurn}
            className="px-6 py-3 rounded-xl bg-beer-700 hover:bg-beer-800 text-white font-bold shadow-lg"
          >
            ⏭ {t('play.endTurn')}
          </button>
        )}
      </div>

      {isHost && (
        <details className="w-full bg-white/80 rounded-xl p-3 mt-4">
          <summary className="font-semibold text-beer-800 cursor-pointer">
            👑 {t('play.hostActions')}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {ordered.map((p) => (
              <li key={p.peerId} className="flex items-center justify-between text-sm">
                <span>
                  {p.emoji} {p.nickname}
                </span>
                <span className="flex gap-1">
                  <button
                    onClick={() => adjustLife(p.peerId, +1)}
                    className="px-2 py-1 bg-green-200 hover:bg-green-300 rounded"
                  >
                    {t('play.addLife')}
                  </button>
                  <button
                    onClick={() => adjustLife(p.peerId, -1)}
                    className="px-2 py-1 bg-red-200 hover:bg-red-300 rounded"
                  >
                    {t('play.removeLife')}
                  </button>
                  <button
                    onClick={() => kick(p.peerId)}
                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    {t('play.kick')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
