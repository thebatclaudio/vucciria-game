import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '@/components/Card'
import NotoEmoji from '@/components/NotoEmoji'
import PlayerPickerDialog, { type PickerMode } from '@/components/PlayerPickerDialog'
import { useGameRoom, useGameMeta, usePlayers } from '@/net/hooks'
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

  // --- Status message (waiting / your turn / resolved summary) ----------

  const getStatusMessage = (): string => {
    const name = currentPlayer?.nickname ?? '?'
    if (phase === 'awaiting-draw') {
      return isMyTurn
        ? `🎯 ${t('play.yourTurnDraw')}`
        : t('play.waitingForDraw', { name })
    }
    if (phase === 'awaiting-drawer-pick') {
      if (isMyTurn) {
        // Dialog handles the picker; status banner stays informational.
        return currentCard?.effect.resolution === 'duel'
          ? `⚔️ ${t('play.phase.duelPickOpponent')}`
          : `👉 ${t('play.phase.drawerPick')}`
      }
      return currentCard?.effect.resolution === 'duel'
        ? t('play.phase.waitingDuelPick', { name })
        : t('play.phase.waitingDrawerPick', { name })
    }
    if (phase === 'awaiting-host-pick') {
      const tc = currentCard?.effect.targetCount
      if (isHost) {
        if (currentCard?.effect.resolution === 'duel') {
          return `👑 ${t('play.phase.hostPickDuelLoser')}`
        }
        return tc === 1
          ? `👑 ${t('play.phase.hostPickLoser')}`
          : `👑 ${t('play.phase.hostPickLosers')}`
      }
      return t('play.phase.waitingHostPick')
    }
    // resolved — show the effect summary instead of the old generic banner.
    if (!currentCard) return ''
    const drawer = ordered.find((p) => p.seat === meta?.turnSeat) ?? null
    return buildEffectSummary({
      cardId: currentCard.id,
      drawerId: drawer?.peerId ?? null,
      players: ordered,
      chosenIds: lastResolvedTargets,
      t,
    })
  }

  // --- Card click behavior ----------------------------------------------
  //
  // The card itself doubles as a CTA:
  //   - resolved + my turn (seat)  → click ends the turn (matches the
  //     dedicated button, but lets the dying drawer close their turn too).
  //   - awaiting-drawer-pick + my turn → no-op (the dialog auto-opens and
  //     is mandatory; we keep the prop set so the affordance is visible).
  //   - awaiting-host-pick + I'm host → same: dialog auto-opens.
  // Other phases / non-actors → not clickable.

  let cardOnClick: (() => void) | null = null
  let cardCta: string | null = null
  if (phase === 'resolved' && isMyTurnSeat) {
    cardOnClick = endTurn
    cardCta = t('play.card.cta.endTurn')
  } else if (phase === 'awaiting-drawer-pick' && isMyTurn) {
    // Dialog is already open; clicking the card is a harmless no-op but
    // we keep the CTA hint so the user sees the next step.
    cardOnClick = () => {
      /* dialog already handles the action */
    }
    cardCta = t('play.card.cta.pick')
  } else if (phase === 'awaiting-host-pick' && isHost) {
    cardOnClick = () => {
      /* dialog already handles the action */
    }
    cardCta = t('play.card.cta.pick')
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4 mt-4">
      <div className="text-center">
        <p className="text-beer-800 font-semibold text-lg">{getStatusMessage()}</p>
      </div>

      <Card
        cardId={meta.lastCardId ?? null}
        onClick={cardOnClick}
        ctaLabel={cardCta}
      />

      <div className="flex gap-3 min-h-[52px] flex-wrap justify-center">
        {phase === 'awaiting-draw' && isMyTurn && (
          <button
            onClick={draw}
            className="px-6 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 text-white font-bold shadow-lg"
          >
            🎴 {t('play.draw')}
          </button>
        )}

        {phase === 'resolved' && isMyTurnSeat && (
          <button
            onClick={endTurn}
            className="px-6 py-3 rounded-xl bg-beer-700 hover:bg-beer-800 text-white font-bold shadow-lg"
          >
            ⏭ {t('play.endTurn')}
          </button>
        )}

        {!isMyTurn &&
          phase !== 'awaiting-host-pick' &&
          phase !== 'awaiting-drawer-pick' &&
          phase !== 'resolved' && (
            <div className="px-4 py-2 rounded-lg bg-beer-100 text-beer-700 text-sm flex items-center">
              {t('play.notYourTurn')}
            </div>
          )}
      </div>

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
              className={`flex items-center justify-between bg-white/80 rounded-lg px-3 py-2 transition
                ${isCurrent ? 'ring-2 ring-beer-600 bg-beer-50' : ''}
                ${isDead ? 'opacity-50' : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <NotoEmoji emoji={p.emoji} size={28} animated={isCurrent} />
                <span className="font-semibold truncate">
                  {isHostPlayer && <span className="mr-1">👑</span>}
                  {p.nickname}
                </span>
                {isSelf && (
                  <span className="text-xs text-beer-600 shrink-0">
                    ({t('lobby.you')})
                  </span>
                )}
                {isCurrent && phase !== 'awaiting-draw' && (
                  <span className="text-sm shrink-0" title="Showing card">
                    🎴
                  </span>
                )}
              </span>
              <span className="flex gap-0.5 text-base shrink-0 ml-2 items-center">
                {Array.from({ length: p.lives }).map((_, i) => (
                  <span key={i}>🥃</span>
                ))}
                {p.peerId === meta?.jollyHolderId && (
                  <span className="ml-1" title="Jolly token">
                    🃏
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {isHost && (
        <details className="w-full bg-white/80 rounded-xl p-3 mt-4">
          <summary className="font-semibold text-beer-800 cursor-pointer">
            👑 {t('play.hostActions')}
          </summary>
          <p className="text-xs text-beer-700 mt-1 mb-2 italic">
            {t('play.hostActionsHint')}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {ordered.map((p) => (
              <li
                key={p.peerId}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-1">
                  <NotoEmoji emoji={p.emoji} size={20} />
                  <span>{p.nickname}</span>
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
    </div>
  )
}
