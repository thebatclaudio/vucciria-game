import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '@/components/Card'
import NotoEmoji from '@/components/NotoEmoji'
import PlayerPickerDialog, { type PickerMode } from '@/components/PlayerPickerDialog'
import StatusHeader, { type PhaseChipTone } from '@/components/StatusHeader'
import { LifeRow } from '@/components/LifeGlass'
import { PrimaryButton } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/useToast'
import { useGameRoom, useGameMeta, usePlayers, usePeerCount } from '@/net/hooks'
import { getMeta, getDeck, getPlayers } from '@/net/ydoc'
import { drawNext } from '@/game/deck'
import { orderedPlayers, alivePlayers, nextTurnSeat, checkWinner } from '@/game/rules'
import { getOrCreatePlayerId } from '@/game/identity'
import { applyCardEffect, initialPhaseFor } from '@/game/effects'
import { getCard } from '@/game/cards'
import { buildEffectSummary } from '@/game/effectSummary'

export default function Play() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { code } = useParams<{ code: string }>()
  const binding = useGameRoom(code)
  const meta = useGameMeta(binding?.doc ?? null)
  const players = usePlayers(binding?.doc ?? null)
  const peerCount = usePeerCount(binding?.room ?? null)
  const toast = useToast()

  // Confirmation gates: kick (peerId) and "set lives to 0" (peerId).
  // Carrying the target id in state lets the dialog body name the player.
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)
  const [confirmZeroId, setConfirmZeroId] = useState<string | null>(null)

  // Stable per-tab player id (must match the one used in Lobby).
  const playerId = useMemo(() => (code ? getOrCreatePlayerId(code) : null), [code])

  // Local-only selection buffer for the picker. Not part of CRDT state:
  // we only commit to the shared doc when the chooser confirms. This
  // avoids spamming the network and keeps the picker UI responsive.
  const [pickSelection, setPickSelection] = useState<string[]>([])

  // Remember the targets that were actually resolved on the current card,
  // so the `resolved`-phase effect summary can still display them after
  // `applyCardEffect` has cleared `pendingChosenIds`. Cleared on each
  // new draw / phase reset.
  const [lastResolvedTargets, setLastResolvedTargets] = useState<string[]>([])

  const ordered = orderedPlayers(players)
  const me = ordered.find((p) => p.peerId === playerId) ?? null
  const isHost = meta?.hostPeerId === playerId

  // Kicked-mid-game toast. If our own entry disappears from the players
  // map while the game is still `playing`, the host removed us. Show a
  // toast and route back to the dashboard. `everSeatedRef` prevents the
  // effect from firing on the first paint while the doc is still
  // syncing (we haven't seen ourselves yet then).
  const everSeatedRef = useRef(false)
  useEffect(() => {
    if (me) everSeatedRef.current = true
  }, [me])
  useEffect(() => {
    if (!everSeatedRef.current) return
    if (me) return
    if (meta?.status !== 'playing') return
    toast.show({ message: t('toast.kicked'), tone: 'danger', durationMs: 5000 })
    nav('/dashboard')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, meta?.status])
  // Seat-only: true even if the player at this seat has 0 lives. Used to
  // allow a player who just died on their own card to end their own turn
  // (otherwise the game would deadlock on `resolved`).
  const isMyTurnSeat = me?.seat === meta?.turnSeat
  const isMyTurn = isMyTurnSeat && (me?.lives ?? 0) > 0

  const phase = meta?.cardPhase ?? 'awaiting-draw'
  const currentCard = meta?.lastCardId ? getCard(meta.lastCardId) : null

  // Reset the local picker buffer and resolved-targets cache whenever the
  // phase resets to awaiting-draw or a new card lands, so old selections
  // don't bleed across turns.
  useEffect(() => {
    setPickSelection([])
    if (meta?.cardPhase === 'awaiting-draw') {
      setLastResolvedTargets([])
    }
  }, [meta?.lastCardId, meta?.cardPhase])

  // Navigate to game-over when the status flips — triggered by endTurn or
  // by the winner-watch effect below.
  useEffect(() => {
    if (meta?.status === 'over' && code) nav(`/over/${code}`)
  }, [meta?.status, code, nav])

  // Stale-turn recovery: if turnSeat points at a missing or dead player,
  // advance. Only the lowest-seat alive peer drives the fixup to avoid
  // write-storm. Also resets cardPhase so the new current player can draw.
  useEffect(() => {
    if (!binding || meta?.status !== 'playing') return
    const alive = alivePlayers(players)
    if (alive.length === 0) return
    const currentExists = alive.some((p) => p.seat === meta.turnSeat)
    if (currentExists) return
    if (alive[0].peerId !== playerId) return
    const next = nextTurnSeat(players, meta.turnSeat ?? -1)
    binding.doc.transact(() => {
      const m = getMeta(binding.doc)
      m.set('turnSeat', next)
      m.set('lastCardId', null)
      m.set('cardPhase', 'awaiting-draw')
      m.set('pendingChosenIds', [])
    })
  }, [binding, players, meta?.turnSeat, meta?.status, playerId])

  // Winner-watch: any time the player roster or starting-count changes,
  // check if the game is over. We do this in addition to the explicit
  // check inside endTurn so the game can also end when:
  //   - the dying drawer can't / doesn't press End turn, or
  //   - the host zeros someone's lives via the override panel,
  //   - a kick leaves a single survivor.
  // Election: only the lowest-seat alive peer commits the transition,
  // exactly like the stale-turn recovery effect, to avoid write storms.
  useEffect(() => {
    if (!binding || meta?.status !== 'playing') return
    const startingCount = meta?.startingPlayerCount ?? 0
    const winner = checkWinner(players, startingCount)
    if (!winner) return
    const alive = alivePlayers(players)
    if (alive.length === 0 || alive[0].peerId !== playerId) return
    binding.doc.transact(() => {
      const m = getMeta(binding.doc)
      if ((m.get('status') as string) === 'over') return
      m.set('status', 'over')
      m.set('winnerPeerId', winner.peerId)
    })
  }, [
    binding,
    players,
    meta?.status,
    meta?.startingPlayerCount,
    playerId,
  ])

  // --- Draw ---------------------------------------------------------------

  const draw = () => {
    if (!binding || !isMyTurn || !playerId) return
    if (phase !== 'awaiting-draw') return
    const m = getMeta(binding.doc)
    const deck = getDeck(binding.doc)
    const currentIndex = (m.get('deckIndex') as number) ?? 0
    const seed = ((m.get('createdAt') as number) ?? Date.now()) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(
      deck.toArray(),
      currentIndex,
      seed,
    )

    // 1) Commit the draw to CRDT.
    binding.doc.transact(() => {
      m.set('lastCardId', cardId)
      if (nextDeck !== deck.toArray()) {
        deck.delete(0, deck.length)
        deck.insert(0, nextDeck)
      }
      m.set('deckIndex', nextIndex)
      m.set('pendingChosenIds', [])
      m.set('cardPhase', initialPhaseFor(cardId))
    })

    // 2) For auto cards, apply the effect immediately. The drawer is the
    //    only writer (avoids double-apply: other peers just observe).
    const card = getCard(cardId)
    if (card.effect.resolution === 'auto') {
      applyCardEffect(binding.doc, cardId, playerId)
      // For the summary view: auto card targets are derived from the
      // resolver, but stash a non-empty marker so we know it's resolved.
      setLastResolvedTargets([playerId])
    } else {
      setLastResolvedTargets([])
    }
    // 'manual' (mossa) already lands in 'resolved' via initialPhaseFor.
    // 'drawer-choice' / 'duel' / 'host-choice' wait for input.
  }

  // --- Drawer pick (drawer-choice + duel step 1) -------------------------

  const confirmDrawerPick = () => {
    if (!binding || !isMyTurn || !playerId || !currentCard) return
    if (phase !== 'awaiting-drawer-pick') return
    if (pickSelection.length !== 1) return
    const targetId = pickSelection[0]

    const res = currentCard.effect.resolution
    if (res === 'drawer-choice') {
      // Apply the effect with the chosen target. drawerDelta (if any) is
      // applied inside applyCardEffect.
      applyCardEffect(binding.doc, currentCard.id, playerId, [targetId])
      setLastResolvedTargets([targetId])
    } else if (res === 'duel') {
      // Hand off to the host: store opponent in pendingChosenIds.
      binding.doc.transact(() => {
        const m = getMeta(binding.doc)
        m.set('pendingChosenIds', [targetId])
        m.set('cardPhase', 'awaiting-host-pick')
      })
    }
    setPickSelection([])
  }

  // --- Host pick (host-choice + duel step 2) -----------------------------

  const confirmHostPick = () => {
    if (!binding || !isHost || !currentCard || !playerId) return
    if (phase !== 'awaiting-host-pick') return
    const res = currentCard.effect.resolution
    const drawer = ordered.find((p) => p.seat === meta?.turnSeat)
    if (!drawer) return

    if (res === 'host-choice') {
      const tc = currentCard.effect.targetCount
      if (tc === 1 && pickSelection.length !== 1) return
      // tc === 'any' allows empty selection (no one lost).
      applyCardEffect(binding.doc, currentCard.id, drawer.peerId, pickSelection)
      setLastResolvedTargets([...pickSelection])
    } else if (res === 'duel') {
      // Host declares the loser among {drawer, opponent}.
      if (pickSelection.length !== 1) return
      const opponentId = meta?.pendingChosenIds?.[0]
      const loserId = pickSelection[0]
      if (!opponentId) return
      if (loserId !== drawer.peerId && loserId !== opponentId) return
      applyCardEffect(binding.doc, currentCard.id, drawer.peerId, [loserId])
      setLastResolvedTargets([loserId])
    }
    setPickSelection([])
  }

  // --- End turn -----------------------------------------------------------

  const endTurn = () => {
    // Allow seat-based end-turn so a player who just died on their own
    // card can still close the turn. The winner-watch effect will fire
    // separately if this transition reveals a winner.
    if (!binding || !isMyTurnSeat) return
    if (phase !== 'resolved') return
    const startingCount = meta?.startingPlayerCount ?? 0
    const winner = checkWinner(players, startingCount)
    binding.doc.transact(() => {
      const m = getMeta(binding.doc)
      if (winner) {
        m.set('status', 'over')
        m.set('winnerPeerId', winner.peerId)
      } else {
        const next = nextTurnSeat(players, meta?.turnSeat ?? 0)
        m.set('turnSeat', next)
        m.set('lastCardId', null)
        m.set('cardPhase', 'awaiting-draw')
        m.set('pendingChosenIds', [])
      }
    })
  }

  // --- Host override panel ------------------------------------------------

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
    binding.doc.transact(() => {
      getPlayers(binding.doc).delete(peerId)
      const m = getMeta(binding.doc)
      if ((m.get('jollyHolderId') as string | null) === peerId) {
        m.set('jollyHolderId', null)
      }
    })
  }

  if (!code || !meta) return null

  const currentPlayer = ordered.find((p) => p.seat === meta.turnSeat)

  // --- Picker dialog wiring ----------------------------------------------
  //
  // Decide which (if any) picker is active for the current viewer based on
  // phase + role. Only the chooser sees the dialog; everyone else sees a
  // waiting status banner.

  type PickerSpec = {
    mode: PickerMode
    allowEmpty: boolean
    candidates: string[]
    title: string
    subtitle?: string
    confirm: () => void
  }

  let pickerSpec: PickerSpec | null = null

  if (phase === 'awaiting-drawer-pick' && isMyTurn && currentCard) {
    if (currentCard.effect.resolution === 'duel') {
      pickerSpec = {
        mode: 'single',
        allowEmpty: false,
        candidates: alivePlayers(players)
          .filter((p) => p.peerId !== playerId)
          .map((p) => p.peerId),
        title: t('play.dialog.title.duelOpponent'),
        subtitle: t(`cards.${currentCard.id}.title`),
        confirm: confirmDrawerPick,
      }
    } else {
      pickerSpec = {
        mode: 'single',
        allowEmpty: false,
        candidates: alivePlayers(players).map((p) => p.peerId),
        title: t('play.dialog.title.drawerPick'),
        subtitle: t(`cards.${currentCard.id}.title`),
        confirm: confirmDrawerPick,
      }
    }
  } else if (phase === 'awaiting-host-pick' && isHost && currentCard) {
    if (currentCard.effect.resolution === 'duel') {
      const drawer = ordered.find((p) => p.seat === meta.turnSeat)
      const opponentId = meta.pendingChosenIds?.[0]
      pickerSpec = {
        mode: 'single',
        allowEmpty: false,
        candidates: [
          ...(drawer ? [drawer.peerId] : []),
          ...(opponentId ? [opponentId] : []),
        ],
        title: t('play.dialog.title.hostPickDuelLoser'),
        subtitle: t(`cards.${currentCard.id}.title`),
        confirm: confirmHostPick,
      }
    } else {
      const tc = currentCard.effect.targetCount
      pickerSpec = {
        mode: tc === 1 ? 'single' : 'multi',
        allowEmpty: tc === 'any',
        candidates: alivePlayers(players).map((p) => p.peerId),
        title:
          tc === 1
            ? t('play.dialog.title.hostPickLoser')
            : t('play.dialog.title.hostPickLosers'),
        subtitle: t(`cards.${currentCard.id}.title`),
        confirm: confirmHostPick,
      }
    }
  }

  const onTogglePick = (peerId: string) => {
    if (!pickerSpec) return
    if (pickerSpec.mode === 'single') {
      setPickSelection((prev) => (prev[0] === peerId ? [] : [peerId]))
    } else {
      setPickSelection((prev) =>
        prev.includes(peerId)
          ? prev.filter((id) => id !== peerId)
          : [...prev, peerId],
      )
    }
  }

  // --- Phase chip + prompt (consumed by <StatusHeader>) ------------------
  //
  // Each (phase × viewer-role) maps to two things:
  //   1. `phaseTone` / `phaseLabel`: a semantic chip that says *what stage
  //      of the turn we're in* (Awaiting draw / Drawer picking / Host
  //      deciding / Resolved). Color carries the urgency:
  //        - `self`     → accent (action expected from me)
  //        - `waiting`  → amber pulse (action expected from someone else)
  //        - `resolved` → green (turn closed, drawer can end)
  //        - `idle`     → grey (nothing happening here)
  //   2. `prompt`: a single-sentence nudge for the *local viewer*. Empty
  //      for observers so the header stays compact.
  //
  // The "resolved" prompt deliberately reuses `buildEffectSummary` so the
  // human-readable outcome (who drank, jolly transfers, etc.) still
  // appears — just inside the header instead of as a free-floating <p>.

  type Banner = {
    phaseLabel: string
    phaseTone: PhaseChipTone
    prompt: string | null
  }

  const banner: Banner = (() => {
    const drawerName = currentPlayer?.nickname ?? '?'
    if (phase === 'awaiting-draw') {
      return isMyTurn
        ? {
            phaseLabel: t('play.phaseChip.awaitingDraw'),
            phaseTone: 'self',
            prompt: t('play.prompt.draw'),
          }
        : {
            phaseLabel: t('play.phaseChip.awaitingDraw'),
            phaseTone: 'waiting',
            prompt: t('play.prompt.waiting', { name: drawerName }),
          }
    }
    if (phase === 'awaiting-drawer-pick') {
      const isDuel = currentCard?.effect.resolution === 'duel'
      const chipLabel = isDuel
        ? t('play.phaseChip.duelPicking')
        : t('play.phaseChip.drawerPicking')
      if (isMyTurn) {
        return {
          phaseLabel: chipLabel,
          phaseTone: 'self',
          prompt: isDuel
            ? t('play.prompt.duelPick')
            : t('play.prompt.pick'),
        }
      }
      return {
        phaseLabel: chipLabel,
        phaseTone: 'waiting',
        prompt: t('play.prompt.waiting', { name: drawerName }),
      }
    }
    if (phase === 'awaiting-host-pick') {
      const tc = currentCard?.effect.targetCount
      if (isHost) {
        return {
          phaseLabel: t('play.phaseChip.hostPicking'),
          phaseTone: 'self',
          prompt: tc === 'any'
            ? t('play.prompt.hostPickAny')
            : t('play.prompt.hostPick'),
        }
      }
      return {
        phaseLabel: t('play.phaseChip.hostPicking'),
        phaseTone: 'waiting',
        prompt: null,
      }
    }
    // resolved
    if (!currentCard) {
      return {
        phaseLabel: t('play.phaseChip.resolved'),
        phaseTone: 'resolved',
        prompt: null,
      }
    }
    const drawer = ordered.find((p) => p.seat === meta?.turnSeat) ?? null
    const summary = buildEffectSummary({
      cardId: currentCard.id,
      drawerId: drawer?.peerId ?? null,
      players: ordered,
      chosenIds: lastResolvedTargets,
      t,
    })
    return {
      phaseLabel: t('play.phaseChip.resolved'),
      phaseTone: 'resolved',
      prompt: summary || (isMyTurnSeat ? t('play.prompt.endTurn') : null),
    }
  })()

  const drawer = ordered.find((p) => p.seat === meta.turnSeat) ?? null
  const drawerIsHost = drawer?.peerId === meta.hostPeerId
  const isDrawerLocal = drawer?.peerId === playerId

  return (
    <div
      className="w-full max-w-md flex flex-col items-center gap-4 mt-4"
      // Reserve room at the bottom for the sticky action bar so the player
      // list never lives under it. Matches the bar's `h-20 + safe inset`.
      style={{
        paddingBottom: 'calc(5rem + var(--safe-b))',
      }}
    >
      {/* Connection chip — surfaces P2P health while playing, not just in
          the lobby. A dropped connection mid-game manifests as silent stale
          state otherwise. */}
      <div className="flex items-center justify-center">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-chip text-xs font-semibold
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
      </div>

      {/* 3-row status header: avatar + lives → phase chip → prompt */}
      <StatusHeader
        drawer={drawer}
        isDrawer={isDrawerLocal}
        isHost={drawerIsHost}
        startingLives={meta.startingLives ?? drawer?.lives ?? 0}
        hasJolly={!!drawer && drawer.peerId === meta.jollyHolderId}
        phaseLabel={banner.phaseLabel}
        phaseTone={banner.phaseTone}
        prompt={banner.prompt}
      />

      {/* Card is now pure content; no longer a CTA. */}
      <Card cardId={meta.lastCardId ?? null} />

      {/* Player list (bottom of play area) — now read-only status rows.
          All target selection happens inside the modal dialog. */}
      <ul className="w-full flex flex-col gap-2">
        {ordered.map((p) => {
          const isCurrent = p.seat === meta.turnSeat
          const isSelf = p.peerId === playerId
          const isHostPlayer = p.peerId === meta.hostPeerId
          const isDead = p.lives <= 0

          return (
            <li
              key={p.peerId}
              className={`flex items-center justify-between bg-white rounded-surface px-3 py-2 ring-1 ring-ink/10 shadow-elev-1 transition
                ${isCurrent ? 'ring-2 ring-accent' : ''}
                ${isDead ? 'opacity-50' : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <NotoEmoji emoji={p.emoji} size={28} animated={isCurrent} />
                <span className="font-semibold truncate text-ink">
                  {isHostPlayer && (
                    <span aria-hidden className="mr-1">👑</span>
                  )}
                  {p.nickname}
                </span>
                {isSelf && (
                  <span className="text-xs text-ink-soft shrink-0">
                    ({t('lobby.you')})
                  </span>
                )}
                {isCurrent && phase !== 'awaiting-draw' && (
                  <span
                    aria-label="Showing card"
                    className="text-sm shrink-0"
                  >
                    🎴
                  </span>
                )}
              </span>
              <LifeRow
                lives={p.lives}
                max={meta.startingLives ?? p.lives}
                hasJolly={p.peerId === meta?.jollyHolderId}
              />
            </li>
          )
        })}
      </ul>

      {isHost && (
        // Phase 2.3 — host panel promoted from a collapsed `<details>` to
        // an always-visible card. The dashed accent border + 👑 badge
        // signal "elevated controls" without competing with the play CTA.
        <section
          aria-labelledby="host-panel-heading"
          className="w-full bg-white rounded-card p-3 mt-2 ring-1 ring-accent/30 border-2 border-dashed border-accent/40 shadow-elev-1"
        >
          <div className="flex items-center justify-between mb-1">
            <h2
              id="host-panel-heading"
              className="font-semibold text-ink text-sm flex items-center gap-1"
            >
              <span aria-hidden>👑</span> {t('play.hostActions')}
            </h2>
            <span className="text-[10px] uppercase tracking-button text-accent font-bold bg-canvas px-2 py-0.5 rounded-chip ring-1 ring-accent/30">
              Host
            </span>
          </div>
          <p className="text-xs text-ink-soft mb-2 italic">
            {t('play.hostActionsHint')}
          </p>
          <ul className="flex flex-col gap-2">
            {ordered.map((p) => (
              <li
                key={p.peerId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-1 min-w-0">
                  <NotoEmoji emoji={p.emoji} size={20} />
                  <span className="truncate text-ink">{p.nickname}</span>
                </span>
                <span className="flex gap-1 shrink-0">
                  <button
                    onClick={() => adjustLife(p.peerId, +1)}
                    aria-label={`${t('play.addLife')} (${p.nickname})`}
                    className="min-w-11 min-h-9 px-2 py-1 bg-success-soft text-success border border-success/40 hover:bg-success hover:text-white rounded font-semibold transition"
                  >
                    {t('play.addLife')}
                  </button>
                  <button
                    onClick={() => {
                      // "to zero" is destructive — surface a confirm step.
                      // For other decrements (≥2 → ≥1 etc.) the host can
                      // apply directly without nagging.
                      if (p.lives <= 1) {
                        setConfirmZeroId(p.peerId)
                      } else {
                        adjustLife(p.peerId, -1)
                      }
                    }}
                    aria-label={`${t('play.removeLife')} (${p.nickname})`}
                    className="min-w-11 min-h-9 px-2 py-1 bg-danger-soft text-danger border border-danger/40 hover:bg-danger hover:text-white rounded font-semibold transition"
                  >
                    {t('play.removeLife')}
                  </button>
                  <button
                    onClick={() => setConfirmKickId(p.peerId)}
                    aria-label={`${t('play.kick')} (${p.nickname})`}
                    className="min-w-11 min-h-9 px-2 py-1 bg-white text-ink border border-ink/30 hover:bg-ink hover:text-white rounded font-semibold transition"
                  >
                    {t('play.kick')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mandatory player-selection dialog. Mounted only when a pick is
          required from the local user. */}
      {pickerSpec && (
        <PlayerPickerDialog
          open={true}
          title={pickerSpec.title}
          subtitle={pickerSpec.subtitle}
          candidates={ordered.filter((p) =>
            pickerSpec!.candidates.includes(p.peerId),
          )}
          selection={pickSelection}
          onToggle={onTogglePick}
          mode={pickerSpec.mode}
          allowEmpty={pickerSpec.allowEmpty}
          onConfirm={pickerSpec.confirm}
          highlightPeerId={currentPlayer?.peerId ?? null}
        />
      )}

      {/* Sticky bottom action bar.
          --------------------------
          The primary CTA (Draw / End turn) used to live in the middle of
          the column, which meant 4+ players pushed it off-screen and the
          drawer had to scroll back up to act. Pinning it to the viewport
          floor matches the iOS/Android tab-bar convention and lets the
          page content above scroll independently.

          Layered: `bottom-0 inset-x-0` covers the viewport bottom edge;
          the inner pill is centered with the same `max-w-md` as the
          column. Backdrop blur keeps the player list visible underneath
          while the bar reads as a separate plane.

          Safe-area: padded for the iOS home indicator via `--safe-b`. */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 px-4 pt-3 bg-canvas/60 backdrop-blur-sm pointer-events-none"
        style={{
          paddingBottom: 'calc(0.75rem + var(--safe-b))',
        }}
      >
        <div className="max-w-md mx-auto flex justify-center pointer-events-auto">
          {phase === 'awaiting-draw' && isMyTurn && (
            <PrimaryButton onClick={draw} leadingIcon="🎴" block={false}>
              {t('play.draw')}
            </PrimaryButton>
          )}

          {phase === 'resolved' && isMyTurnSeat && (
            <PrimaryButton onClick={endTurn} leadingIcon="⏭" block={false}>
              {t('play.endTurn')}
            </PrimaryButton>
          )}

          {/* Non-actor placeholder: keeps the bar height stable so the
              page padding-bottom reservation doesn't have to flex. */}
          {!isMyTurn &&
            phase !== 'awaiting-host-pick' &&
            phase !== 'awaiting-drawer-pick' &&
            phase !== 'resolved' && (
              <div className="h-12 px-4 rounded-chip bg-white/70 text-ink-soft text-xs uppercase tracking-button flex items-center ring-1 ring-ink/10">
                {t('play.notYourTurn')}
              </div>
            )}

          {/* Pick phases — the dialog handles the action; render a calm
              waiting indicator so the bar still occupies its slot. */}
          {(phase === 'awaiting-host-pick' ||
            phase === 'awaiting-drawer-pick') &&
            !(isMyTurn || isHost) && (
              <div className="h-12 px-4 rounded-chip bg-white/70 text-ink-soft text-xs uppercase tracking-button flex items-center ring-1 ring-ink/10">
                {t('play.phase.waitingHostPick')}
              </div>
            )}
        </div>
      </div>

      {/* Host-only destructive confirmations. The dialogs name the target
          player so the host doesn't misclick on a busy player list. */}
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
      <ConfirmDialog
        open={confirmZeroId !== null}
        title={t('confirm.zeroLives.title', {
          name:
            ordered.find((p) => p.peerId === confirmZeroId)?.nickname ?? '?',
        })}
        body={t('confirm.zeroLives.body')}
        confirmLabel={t('confirm.zeroLives.confirm')}
        onConfirm={() => {
          if (confirmZeroId) adjustLife(confirmZeroId, -1)
          setConfirmZeroId(null)
        }}
        onCancel={() => setConfirmZeroId(null)}
      />
    </div>
  )
}
