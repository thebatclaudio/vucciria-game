import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameRoom, useGameMeta, usePlayers, usePeerCount } from '@/net/hooks'
import { selfId } from '@/net/room'
import {
  getMeta,
  getPlayers,
  getDeck,
  makePlayerMap,
  readPlayers,
} from '@/net/ydoc'
import { shuffledDeck } from '@/game/deck'
import { orderedPlayers } from '@/game/rules'
import { useProfileStore } from '@/store/profile'
import { LifeRow } from '@/components/LifeGlass'
import type { Player } from '@/game/types'

interface PendingSettings {
  name: string
  maxPlayers: number
  startingLives: number
  location: string | null
  isHost: boolean
}

export default function Lobby() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { code } = useParams<{ code: string }>()
  const profile = useProfileStore((s) => s.profile)!
  const binding = useGameRoom(code)
  const meta = useGameMeta(binding?.doc ?? null)
  const players = usePlayers(binding?.doc ?? null)
  const peerCount = usePeerCount(binding?.room ?? null)
  const [copied, setCopied] = useState(false)

  const pending = useMemo<PendingSettings | null>(() => {
    if (!code) return null
    const raw = sessionStorage.getItem(`vucciria:pending:${code}`)
    return raw ? (JSON.parse(raw) as PendingSettings) : null
  }, [code])

  // Bootstrap the doc if we're the creator.
  useEffect(() => {
    if (!binding || !code || !pending?.isHost) return
    const m = getMeta(binding.doc)
    if (m.get('code')) return // already initialized
    binding.doc.transact(() => {
      m.set('code', code)
      m.set('name', pending.name)
      m.set('maxPlayers', pending.maxPlayers)
      m.set('startingLives', pending.startingLives)
      m.set('location', pending.location)
      m.set('hostPeerId', selfId)
      m.set('status', 'lobby')
      m.set('turnSeat', 0)
      m.set('createdAt', Date.now())
      m.set('lastCardId', null)
      m.set('winnerPeerId', null)
      m.set('deckIndex', 0)
      // initial deck seeded from code
      const seed = [...code].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
      const deck = shuffledDeck(seed)
      const ydeck = getDeck(binding.doc)
      ydeck.delete(0, ydeck.length)
      ydeck.insert(0, deck)
    })
    sessionStorage.removeItem(`vucciria:pending:${code}`)
  }, [binding, code, pending])

  // Register ourselves as a player as soon as we have a binding + profile.
  //
  // We intentionally DO NOT wait for `meta.code` to sync from the host: when
  // peer discovery is slow (the public Nostr relays Trystero uses by default
  // can take 5–30s), gating on synced meta means a joiner stares at a totally
  // empty lobby — not even themselves — with no feedback. Worse, our local
  // player entry never exists until sync arrives, so the host can't see us
  // either once a connection finally comes up if we time out first.
  //
  // Yjs is a CRDT, so two peers writing into the `players` map concurrently
  // merges cleanly. `lives` may be temporarily wrong on the joiner until
  // `meta.startingLives` arrives — the follow-up effect below corrects it
  // while we're still in the lobby.
  useEffect(() => {
    if (!binding || !profile) return
    if (meta?.status && meta.status !== 'lobby') return
    const playersMap = getPlayers(binding.doc)
    if (playersMap.has(selfId)) return
    const existing = readPlayers(binding.doc)
    const nextSeat = (orderedPlayers(existing).at(-1)?.seat ?? -1) + 1
    const newPlayer: Player = {
      peerId: selfId,
      nickname: profile.nickname,
      emoji: profile.emoji,
      lives: meta?.startingLives ?? 3,
      seat: nextSeat,
      joinedAt: Date.now(),
    }
    playersMap.set(selfId, makePlayerMap(newPlayer))
  }, [binding, meta?.status, meta?.startingLives, profile])

  // If we self-registered before `meta.startingLives` synced from the host,
  // correct our `lives` once meta arrives — but only while still in the lobby
  // (never overwrite mid-game lives).
  useEffect(() => {
    if (!binding || !meta?.startingLives) return
    if (meta.status && meta.status !== 'lobby') return
    const playersMap = getPlayers(binding.doc)
    const me = playersMap.get(selfId)
    if (!me) return
    if ((me.get('lives') as number) !== meta.startingLives) {
      me.set('lives', meta.startingLives)
    }
  }, [binding, meta?.startingLives, meta?.status])

  // Auto-navigate when the game starts.
  useEffect(() => {
    if (meta?.status === 'playing' && code) nav(`/play/${code}`)
  }, [meta?.status, code, nav])

  // Host migration: if host has left, lowest-seat player becomes host.
  useEffect(() => {
    if (!binding || !meta || players.length === 0) return
    if (players.some((p) => p.peerId === meta.hostPeerId)) return
    const sorted = orderedPlayers(players)
    if (sorted[0]?.peerId !== selfId) return
    getMeta(binding.doc).set('hostPeerId', selfId)
  }, [binding, meta, players])

  const ordered = orderedPlayers(players)
  const isHost = meta?.hostPeerId === selfId

  const start = () => {
    if (!binding || ordered.length < 2) return
    getMeta(binding.doc).set('status', 'playing')
    getMeta(binding.doc).set('turnSeat', ordered[0].seat)
  }

  const leave = () => {
    binding?.leave()
    nav('/dashboard')
  }

  const kick = (peerId: string) => {
    if (!binding || !isHost) return
    getPlayers(binding.doc).delete(peerId)
  }

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable on some mobile contexts */
    }
  }

  if (!code) return null

  return (
    <div className="w-full max-w-md flex flex-col gap-4 mt-8">
      <h1 className="text-2xl font-bold text-beer-800 text-center">
        {meta?.name ?? t('lobby.title')}
      </h1>

      <div className="bg-white/90 rounded-2xl p-4 text-center shadow">
        <p className="text-sm text-beer-700">{t('lobby.code')}</p>
        <p className="text-5xl font-mono font-bold tracking-widest text-beer-800 my-2">
          {code}
        </p>
        <p className="text-xs text-beer-600 mb-3">{t('lobby.share')}</p>
        <button
          onClick={copyCode}
          className="px-4 py-1 bg-beer-500 hover:bg-beer-600 text-white text-sm rounded-full"
        >
          {copied ? `✓ ${t('lobby.copied')}` : `📋 ${t('lobby.copy')}`}
        </button>
      </div>

      {/* Connection status */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            peerCount > 0 ? 'bg-green-500' : 'bg-amber-400 animate-pulse'
          }`}
        />
        <span className="text-beer-600">
          {peerCount > 0
            ? t('lobby.connected', { count: peerCount })
            : t('lobby.waitingForPeers')}
        </span>
      </div>

      <h2 className="font-semibold text-beer-800">
        {t('lobby.players', { count: ordered.length, max: meta?.maxPlayers ?? '?' })}
      </h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((p) => (
          <li
            key={p.peerId}
            className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <span className="text-2xl">{p.emoji}</span>
              <span className="font-semibold">{p.nickname}</span>
              {p.peerId === selfId && (
                <span className="text-xs text-beer-600">{t('lobby.you')}</span>
              )}
              {p.peerId === meta?.hostPeerId && (
                <span className="text-xs bg-beer-200 text-beer-800 px-2 py-0.5 rounded-full">
                  👑 {t('lobby.host')}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <LifeRow lives={p.lives} max={meta?.startingLives ?? 3} />
              {isHost && p.peerId !== selfId && (
                <button
                  onClick={() => kick(p.peerId)}
                  className="text-xs text-red-600 hover:underline"
                >
                  {t('lobby.kick')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {isHost ? (
        <button
          onClick={start}
          disabled={ordered.length < 2}
          className="py-3 rounded-xl bg-beer-600 hover:bg-beer-700 disabled:bg-beer-300 text-white font-bold shadow-lg"
        >
          ▶ {t('lobby.start')}
        </button>
      ) : (
        <p className="text-center text-beer-700 italic">{t('lobby.waitingForHost')}</p>
      )}

      {ordered.length < 2 && isHost && (
        <p className="text-center text-sm text-beer-700">{t('lobby.needMorePlayers')}</p>
      )}

      <button onClick={leave} className="text-sm text-red-700 underline mt-4">
        {t('lobby.leave')}
      </button>
    </div>
  )
}
