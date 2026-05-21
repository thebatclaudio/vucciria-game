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
import { orderedPlayers, resolveSeatCollision } from '@/game/rules'
import { getOrCreatePlayerId, clearPlayerId } from '@/game/identity'
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
  const [discoveryStalled, setDiscoveryStalled] = useState(false)

  // Stable per-tab player id (survives refresh, distinct per tab). See
  // src/game/identity.ts for the rationale — Trystero's wire-level selfId
  // is regenerated on every page load and would cause duplicates.
  const playerId = useMemo(() => (code ? getOrCreatePlayerId(code) : null), [code])

  const pending = useMemo<PendingSettings | null>(() => {
    if (!code) return null
    const raw = sessionStorage.getItem(`vucciria:pending:${code}`)
    return raw ? (JSON.parse(raw) as PendingSettings) : null
  }, [code])

  // Bootstrap the doc if we're the creator.
  useEffect(() => {
    if (!binding || !code || !pending?.isHost || !playerId) return
    const m = getMeta(binding.doc)
    if (m.get('code')) return // already initialized
    binding.doc.transact(() => {
      m.set('code', code)
      m.set('name', pending.name)
      m.set('maxPlayers', pending.maxPlayers)
      m.set('startingLives', pending.startingLives)
      m.set('location', pending.location)
      m.set('hostPeerId', playerId)
      m.set('status', 'lobby')
      m.set('turnSeat', 0)
      m.set('createdAt', Date.now())
      m.set('lastCardId', null)
      m.set('winnerPeerId', null)
      m.set('deckIndex', 0)
      m.set('cardPhase', 'awaiting-draw')
      m.set('pendingChosenIds', [])
      m.set('jollyHolderId', null)
      // initial deck seeded from code
      const seed = [...code].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
      const deck = shuffledDeck(seed)
      const ydeck = getDeck(binding.doc)
      ydeck.delete(0, ydeck.length)
      ydeck.insert(0, deck)
    })
    sessionStorage.removeItem(`vucciria:pending:${code}`)
  }, [binding, code, pending, playerId])

  // Register ourselves as a player as soon as we have a binding + profile.
  //
  // We intentionally DO NOT wait for `meta.code` to sync from the host: when
  // peer discovery is slow (the public MQTT brokers Trystero uses by default
  // can take 5–30s), gating on synced meta means a joiner stares at a totally
  // empty lobby — not even themselves — with no feedback. Worse, our local
  // player entry never exists until sync arrives, so the host can't see us
  // either once a connection finally comes up if we time out first.
  //
  // We key by the stable `playerId` (sessionStorage-pinned, survives refresh),
  // NOT the Trystero `selfId` (regenerated every page load). On rejoin after
  // a refresh, if our entry still exists in the rehydrated doc we just claim
  // it and refresh its wire `trysteroPeerId`; otherwise we create a fresh
  // entry. Either way we never end up with a duplicate.
  //
  // Yjs is a CRDT, so two peers writing into the `players` map concurrently
  // merges cleanly. `lives` may be temporarily wrong on the joiner until
  // `meta.startingLives` arrives — the follow-up effect below corrects it
  // while we're still in the lobby.
  useEffect(() => {
    if (!binding || !profile || !playerId) return
    if (meta?.status && meta.status !== 'lobby') return
    const playersMap = getPlayers(binding.doc)
    const existingMe = playersMap.get(playerId)
    if (existingMe) {
      // Rejoin path: refresh our wire id and (if the profile changed since
      // last session) sync nickname/emoji. Don't touch seat or joinedAt.
      if (
        (existingMe.get('trysteroPeerId') as string | undefined) !== selfId
      ) {
        existingMe.set('trysteroPeerId', selfId)
      }
      if (existingMe.get('nickname') !== profile.nickname) {
        existingMe.set('nickname', profile.nickname)
      }
      if (existingMe.get('emoji') !== profile.emoji) {
        existingMe.set('emoji', profile.emoji)
      }
      return
    }
    // Fresh-join path.
    const existing = readPlayers(binding.doc)
    const nextSeat = (orderedPlayers(existing).at(-1)?.seat ?? -1) + 1
    const newPlayer: Player = {
      peerId: playerId,
      nickname: profile.nickname,
      emoji: profile.emoji,
      lives: meta?.startingLives ?? 3,
      seat: nextSeat,
      joinedAt: Date.now(),
      trysteroPeerId: selfId,
    }
    playersMap.set(playerId, makePlayerMap(newPlayer))
  }, [binding, meta?.status, meta?.startingLives, profile, playerId])

  // If we self-registered before `meta.startingLives` synced from the host,
  // correct our `lives` once meta arrives — but only while still in the lobby
  // (never overwrite mid-game lives).
  useEffect(() => {
    if (!binding || !meta?.startingLives || !playerId) return
    if (meta.status && meta.status !== 'lobby') return
    const playersMap = getPlayers(binding.doc)
    const me = playersMap.get(playerId)
    if (!me) return
    if ((me.get('lives') as number) !== meta.startingLives) {
      me.set('lives', meta.startingLives)
    }
  }, [binding, meta?.startingLives, meta?.status, playerId])

  // Heal seat collisions.
  //
  // We self-register before P2P sync completes (see the long comment on the
  // registration effect above). This means both the host AND a joiner can
  // independently compute `nextSeat = 0` and both land at seat 0. After
  // sync, two distinct `peerId`s coexist at the same `seat`. The visible
  // bug: in Play.tsx, `meta.turnSeat === 0` causes BOTH players to see
  // "Your turn" and both get the draw button.
  //
  // The actual resolution is in the pure `resolveSeatCollision` function so
  // it can be unit-tested in isolation (see tests/unit/rules.test.ts). This
  // effect is the side-effecting half: it runs the resolver on every
  // change, and if the resolver returns a new seat, writes it.
  //
  // Guards:
  //   - Lobby only — never change seats mid-game.
  //   - `peerCount > 0` so we don't preemptively yield to a peer that
  //     isn't actually there.
  useEffect(() => {
    if (!binding || !playerId) return
    if (meta?.status && meta.status !== 'lobby') return
    if (peerCount === 0) return
    if (players.length < 2) return
    const newSeat = resolveSeatCollision(players, playerId)
    if (newSeat === null) return
    const playersMap = getPlayers(binding.doc)
    const myMap = playersMap.get(playerId)
    if (!myMap) return
    const oldSeat = myMap.get('seat') as number
    console.log(
      `[lobby] seat collision detected at seat=${oldSeat}; ` +
        `reassigning ${playerId} → seat=${newSeat}`,
    )
    myMap.set('seat', newSeat)
  }, [binding, players, meta?.status, playerId, peerCount])

  // Surface peer-discovery failure: if we've had 0 peers for ~15s, show an
  // actionable hint. As soon as anyone connects (or we re-bind the room),
  // clear the flag and the corresponding timer.
  useEffect(() => {
    if (!binding) {
      setDiscoveryStalled(false)
      return
    }
    if (peerCount > 0) {
      setDiscoveryStalled(false)
      return
    }
    const id = setTimeout(() => setDiscoveryStalled(true), 15_000)
    return () => clearTimeout(id)
  }, [binding, peerCount])

  // Auto-navigate when the game starts.
  useEffect(() => {
    if (meta?.status === 'playing' && code) nav(`/play/${code}`)
  }, [meta?.status, code, nav])

  // Host migration: if the known host has left, lowest-seat player becomes host.
  //
  // CRITICAL: we must distinguish "no host known yet" (meta hasn't synced from
  // the network) from "host has actually left." If we don't, a joiner that
  // self-registers BEFORE P2P discovery completes will see `players=[me]` +
  // `hostPeerId=undefined`, fail the `players.some(p => p.peerId === undefined)`
  // check, elect itself as host, persist that to IndexedDB, and then fight the
  // real host's state once sync finally arrives. The user-visible bug is:
  // "Browser B joins a game and sees only itself, marked as host."
  //
  // Guards:
  //   1. `meta.hostPeerId` must be a defined string (= host bootstrap reached
  //      this peer). Until then we have no opinion about who the host is.
  //   2. We must have at least one connected wire peer. With 0 peers we can't
  //      tell "host left" from "host hasn't reached us yet."
  //   3. The pending settings flag must be absent — if we're the original
  //      host, the bootstrap effect handles host assignment, not this one.
  useEffect(() => {
    if (!binding || !meta || players.length === 0 || !playerId) return
    const knownHost = meta.hostPeerId
    if (typeof knownHost !== 'string' || knownHost.length === 0) return
    if (peerCount === 0) return
    if (players.some((p) => p.peerId === knownHost)) return
    const sorted = orderedPlayers(players)
    if (sorted[0]?.peerId !== playerId) return
    getMeta(binding.doc).set('hostPeerId', playerId)
  }, [binding, meta, players, playerId, peerCount])

  const ordered = orderedPlayers(players)
  const isHost = meta?.hostPeerId === playerId

  const start = () => {
    if (!binding || ordered.length < 2) return
    getMeta(binding.doc).set('status', 'playing')
    getMeta(binding.doc).set('turnSeat', ordered[0].seat)
  }

  const leave = () => {
    // Intentional leave: drop our stable id so a future visit to the same
    // game code in this tab starts fresh (otherwise we'd silently rejoin
    // and resurrect our previous seat).
    if (code) clearPlayerId(code)
    binding?.leave()
    nav('/dashboard')
  }

  const kick = (peerId: string) => {
    if (!binding || !isHost) return
    binding.doc.transact(() => {
      getPlayers(binding.doc).delete(peerId)
      // Defensive: kicking is rare in the lobby (jolly only exists
      // mid-game), but keep meta consistent in case a session reuses
      // the doc after a Game Over.
      const m = getMeta(binding.doc)
      if ((m.get('jollyHolderId') as string | null) === peerId) {
        m.set('jollyHolderId', null)
      }
    })
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

      {discoveryStalled && peerCount === 0 && (
        <p
          role="status"
          className="text-xs text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-center"
        >
          ⚠️ {t('lobby.discoveryStalled')}
        </p>
      )}

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
              {p.peerId === playerId && (
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
              {isHost && p.peerId !== playerId && (
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
