import { useEffect, useMemo, useRef, useState } from 'react'
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
import NotoEmoji from '@/components/NotoEmoji'
import { LifeRow } from '@/components/LifeGlass'
import {
  PrimaryButton,
  SecondaryButton,
  DestructiveButton,
  LinkButton,
} from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/useToast'
import ShareSheet from '@/components/ShareSheet'
import { recordRecentGame } from '@/net/recentGames'
import type { Player } from '@/game/types'

interface PendingSettings {
  name: string
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
  const toast = useToast()
  const [discoveryStalled, setDiscoveryStalled] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // Confirmation gates around destructive actions. We carry the target
  // peerId in state so the dialog body can name the player being kicked.
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)

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

  // Record this game in the local "Recent games" index whenever we have
  // a code + name. The index is read by the Dashboard to render rejoin
  // affordances. Refreshing the row on every meta change is fine — the
  // record helper deduplicates by code.
  useEffect(() => {
    if (!code || !meta?.name) return
    recordRecentGame(code, meta.name)
  }, [code, meta?.name])

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
    binding.doc.transact(() => {
      const m = getMeta(binding.doc)
      m.set('status', 'playing')
      m.set('turnSeat', ordered[0].seat)
      // Snapshot the player count so the end-of-game check still works
      // after players have left or been kicked mid-game.
      m.set('startingPlayerCount', ordered.length)
    })
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

  // Kicked-from-lobby toast. If our own player entry vanishes from the
  // Yjs map while we're still in `/lobby/:code`, the host removed us.
  // Show a toast, then redirect home. We watch a derived "still in
  // players" boolean so the effect doesn't fire on legitimate exit paths
  // like clicking Leave (which navigates first).
  const stillSeated = !!playerId && players.some((p) => p.peerId === playerId)
  const everSeatedRef = useRef(false)
  useEffect(() => {
    if (stillSeated) everSeatedRef.current = true
  }, [stillSeated])
  useEffect(() => {
    if (!everSeatedRef.current) return
    if (stillSeated) return
    if (meta?.status && meta.status !== 'lobby') return
    toast.show({ message: t('toast.kicked'), tone: 'danger', durationMs: 5000 })
    nav('/dashboard')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillSeated])

  if (!code) return null

  return (
    <div className="w-full max-w-md flex flex-col gap-5 mt-8">
      {/* Page title — keeps the game name front and centre. */}
      <header className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-bold text-ink text-center">
          {meta?.name ?? t('lobby.title')}
        </h1>
        {meta && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-soft font-semibold uppercase tracking-button">
              {t('create.startingLives')}
            </span>
            <LifeRow
              lives={meta.startingLives ?? 3}
              max={meta.startingLives ?? 3}
            />
          </div>
        )}
      </header>

      {/* --- Share card --------------------------------------------------
          The lobby code is the single most-shared thing in the app, so it
          gets the largest visual weight. The Share button opens a sheet
          with QR + native share + copy in one place (see ShareSheet). */}
      <section
        aria-labelledby="lobby-share-heading"
        className="bg-white rounded-card p-4 text-center shadow-elev-1 ring-1 ring-ink/5"
      >
        <p
          id="lobby-share-heading"
          className="text-xs text-ink-soft uppercase tracking-button"
        >
          {t('lobby.code')}
        </p>
        <p className="text-5xl font-mono font-bold tracking-widest text-ink my-2 select-all">
          {code}
        </p>
        <SecondaryButton
          onClick={() => setShareOpen(true)}
          className="h-10 text-sm px-4"
        >
          📤 {t('lobby.share')}
        </SecondaryButton>
      </section>

      {/* --- Status card -------------------------------------------------
          One card per logical section so the screen has a clear rhythm
          instead of seven stacked rows. Connection chip + (optional)
          discovery-stalled banner live together so any P2P-related copy
          stays in one place visually. */}
      <section
        aria-labelledby="lobby-status-heading"
        className="bg-white rounded-card p-3 shadow-elev-1 ring-1 ring-ink/5 flex flex-col items-center gap-2"
      >
        <span id="lobby-status-heading" className="sr-only">
          Connection status
        </span>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-chip text-xs font-semibold
            ${
              peerCount > 0
                ? 'bg-success-soft text-success ring-1 ring-success/30'
                : 'bg-warn-soft text-warn ring-1 ring-warn/30'
            }`}
        >
          <span
            aria-hidden
            className={`inline-block w-2 h-2 rounded-full ${
              peerCount > 0 ? 'bg-success' : 'bg-warn animate-pulse'
            }`}
          />
          {peerCount > 0
            ? t('lobby.connected', { count: peerCount })
            : t('lobby.waitingForPeers')}
        </span>

        {discoveryStalled && peerCount === 0 && (
          <p
            role="status"
            className="text-xs text-ink bg-warn-soft border border-warn rounded-surface px-3 py-2 text-center"
          >
            <span aria-hidden>⚠️ </span>
            {t('lobby.discoveryStalled')}
          </p>
        )}
      </section>

      {/* --- Players card ----------------------------------------------- */}
      <section
        aria-labelledby="lobby-players-heading"
        className="bg-white rounded-card p-3 shadow-elev-1 ring-1 ring-ink/5 flex flex-col gap-2"
      >
        <h2
          id="lobby-players-heading"
          className="text-xs text-ink-soft font-semibold uppercase tracking-button px-1"
        >
          {t('lobby.players', { count: ordered.length })}
        </h2>
        <ul className="flex flex-col gap-2">
          {ordered.map((p) => (
            <li
              key={p.peerId}
              className="flex items-center justify-between bg-canvas/30 rounded-surface px-3 py-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <NotoEmoji emoji={p.emoji} size={28} animated />
                <span className="font-semibold truncate text-ink">
                  {p.peerId === meta?.hostPeerId && (
                    <span aria-hidden className="mr-1">👑</span>
                  )}
                  {p.nickname}
                </span>
                {p.peerId === playerId && (
                  <span className="text-xs text-ink-soft">{t('lobby.you')}</span>
                )}
              </span>
              {isHost && p.peerId !== playerId && (
                <LinkButton
                  onClick={() => setConfirmKickId(p.peerId)}
                  className="!text-danger hover:!text-danger shrink-0 text-xs"
                >
                  {t('lobby.kick')}
                </LinkButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* --- Bottom action area ---------------------------------------- */}
      {isHost ? (
        <PrimaryButton
          onClick={start}
          disabled={ordered.length < 2}
          leadingIcon="▶"
        >
          {t('lobby.start')}
        </PrimaryButton>
      ) : (
        <p className="text-center text-ink-soft italic">
          {t('lobby.waitingForHost')}
        </p>
      )}

      {ordered.length < 2 && isHost && (
        <p className="text-center text-sm text-ink-soft">
          {t('lobby.needMorePlayers')}
        </p>
      )}

      <DestructiveButton
        onClick={() => {
          // Solo player can leave without confirmation — there's no game
          // to disrupt and the action is reversible (rejoin same code).
          if (ordered.length <= 1) {
            leave()
            return
          }
          setConfirmLeave(true)
        }}
        block
        className="mt-2"
      >
        {t('lobby.leave')}
      </DestructiveButton>

      <ShareSheet
        open={shareOpen}
        code={code}
        gameName={meta?.name}
        onClose={() => setShareOpen(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title={t('confirm.leaveLobby.title')}
        body={t('confirm.leaveLobby.body')}
        confirmLabel={t('confirm.leaveLobby.confirm')}
        onConfirm={() => {
          setConfirmLeave(false)
          leave()
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      <ConfirmDialog
        open={confirmKickId !== null}
        title={t('confirm.kickPlayer.title', {
          name:
            ordered.find((p) => p.peerId === confirmKickId)?.nickname ?? '?',
        })}
        body={t('confirm.kickPlayer.body')}
        confirmLabel={t('confirm.kickPlayer.confirm')}
        onConfirm={() => {
          if (confirmKickId) kick(confirmKickId)
          setConfirmKickId(null)
        }}
        onCancel={() => setConfirmKickId(null)}
      />
    </div>
  )
}
