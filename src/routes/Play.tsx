import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '@/components/Card'
import PlayerCircle from '@/components/PlayerCircle'
import type { PickerMode } from '@/components/PlayerCircle'
import { useGameRoom, useGameMeta, usePlayers } from '@/net/hooks'
import { getMeta, getDeck, getPlayers } from '@/net/ydoc'
import { drawNext } from '@/game/deck'
import { orderedPlayers, alivePlayers, nextTurnSeat, checkWinner } from '@/game/rules'
import { getOrCreatePlayerId } from '@/game/identity'
import { applyCardEffect, initialPhaseFor } from '@/game/effects'
import { getCard } from '@/game/cards'

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
  // we only commit to the shared doc when the chooser confirms (or, for
  // single-select, immediately on tap). This avoids spamming the network
  // with every checkbox flip and keeps the picker UI responsive.
  const [pickSelection, setPickSelection] = useState<string[]>([])

  const ordered = orderedPlayers(players)
  const me = ordered.find((p) => p.peerId === playerId) ?? null
  const isHost = meta?.hostPeerId === playerId
  const isMyTurn = me?.seat === meta?.turnSeat && (me?.lives ?? 0) > 0

  const phase = meta?.cardPhase ?? 'awaiting-draw'
  const currentCard = meta?.lastCardId ? getCard(meta.lastCardId) : null

  // Reset the local picker buffer whenever the phase resets to awaiting-draw
  // or a new card lands, so old selections don't bleed across turns.
  useEffect(() => {
    setPickSelection([])
  }, [meta?.lastCardId, meta?.cardPhase])

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
    } else if (res === 'duel') {
      // Host declares the loser among {drawer, opponent}.
      if (pickSelection.length !== 1) return
      const opponentId = meta?.pendingChosenIds?.[0]
      const loserId = pickSelection[0]
      if (!opponentId) return
      if (loserId !== drawer.peerId && loserId !== opponentId) return
      applyCardEffect(binding.doc, currentCard.id, drawer.peerId, [loserId])
    }
    setPickSelection([])
  }

  // --- End turn -----------------------------------------------------------

  const endTurn = () => {
    if (!binding || !isMyTurn) return
    if (phase !== 'resolved') return
    binding.doc.transact(() => {
      const m = getMeta(binding.doc)
      const next = nextTurnSeat(players, meta?.turnSeat ?? 0)
      m.set('turnSeat', next)
      m.set('lastCardId', null)
      m.set('cardPhase', 'awaiting-draw')
      m.set('pendingChosenIds', [])
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

  // --- Picker wiring -----------------------------------------------------
  //
  // Decide which (if any) picker is active for the current viewer based on
  // phase + role. Only the chooser sees tappable avatars; everyone else
  // sees a read-only circle.

  let pickerMode: PickerMode = 'none'
  let pickerCandidates: string[] | undefined
  let canConfirm = false
  let confirmFn: (() => void) | null = null

  if (phase === 'awaiting-drawer-pick' && isMyTurn && currentCard) {
    pickerMode = 'single'
    if (currentCard.effect.resolution === 'duel') {
      // Drawer picks opponent — anyone alive except themselves.
      pickerCandidates = alivePlayers(players)
        .filter((p) => p.peerId !== playerId)
        .map((p) => p.peerId)
    } else {
      // drawer-choice — any alive player including self.
      pickerCandidates = alivePlayers(players).map((p) => p.peerId)
    }
    canConfirm = pickSelection.length === 1
    confirmFn = confirmDrawerPick
  } else if (phase === 'awaiting-host-pick' && isHost && currentCard) {
    if (currentCard.effect.resolution === 'duel') {
      // Host picks loser between drawer and the opponent the drawer chose.
      pickerMode = 'single'
      const drawer = ordered.find((p) => p.seat === meta.turnSeat)
      const opponentId = meta.pendingChosenIds?.[0]
      pickerCandidates = [
        ...(drawer ? [drawer.peerId] : []),
        ...(opponentId ? [opponentId] : []),
      ]
      canConfirm = pickSelection.length === 1
      confirmFn = confirmHostPick
    } else {
      // host-choice — anyone alive.
      const tc = currentCard.effect.targetCount
      pickerMode = tc === 1 ? 'single' : 'multi'
      pickerCandidates = alivePlayers(players).map((p) => p.peerId)
      canConfirm = tc === 'any' ? true : pickSelection.length === 1
      confirmFn = confirmHostPick
    }
  }

  const onTogglePick = (peerId: string) => {
    if (pickerMode === 'single') {
      setPickSelection((prev) => (prev[0] === peerId ? [] : [peerId]))
    } else if (pickerMode === 'multi') {
      setPickSelection((prev) =>
        prev.includes(peerId)
          ? prev.filter((id) => id !== peerId)
          : [...prev, peerId],
      )
    }
  }

  // --- Status messages ---------------------------------------------------

  const getStatusMessage = (): string => {
    const name = currentPlayer?.nickname ?? '?'
    if (phase === 'awaiting-draw') {
      return isMyTurn
        ? `🎯 ${t('play.yourTurnDraw')}`
        : t('play.waitingForDraw', { name })
    }
    if (phase === 'awaiting-drawer-pick') {
      if (isMyTurn) {
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
    // resolved
    return isMyTurn
      ? `✅ ${t('play.phase.resolvedYou')}`
      : t('play.phase.resolvedOther', { name })
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4 mt-4">
      <PlayerCircle
        players={ordered}
        currentSeat={meta.turnSeat ?? 0}
        hostPeerId={meta.hostPeerId ?? ''}
        selfPeerId={playerId ?? ''}
        startingLives={meta.startingLives ?? 3}
        showingCard={phase !== 'awaiting-draw'}
        jollyHolderId={meta.jollyHolderId ?? null}
        picker={
          pickerMode === 'none'
            ? undefined
            : {
                mode: pickerMode,
                candidateIds: pickerCandidates,
                selectedIds: pickSelection,
                onToggle: onTogglePick,
              }
        }
      />

      <div className="text-center">
        <p className="text-beer-800 font-semibold text-lg">{getStatusMessage()}</p>
      </div>

      <Card cardId={meta.lastCardId ?? null} />

      <div className="flex gap-3 min-h-[52px] flex-wrap justify-center">
        {phase === 'awaiting-draw' && isMyTurn && (
          <button
            onClick={draw}
            className="px-6 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 text-white font-bold shadow-lg"
          >
            🎴 {t('play.draw')}
          </button>
        )}

        {(phase === 'awaiting-drawer-pick' || phase === 'awaiting-host-pick') &&
          confirmFn && (
            <button
              onClick={confirmFn}
              disabled={!canConfirm}
              className="px-6 py-3 rounded-xl bg-beer-600 hover:bg-beer-700 disabled:bg-beer-300 disabled:cursor-not-allowed text-white font-bold shadow-lg"
            >
              ✅ {t('play.confirmPick')}
            </button>
          )}

        {phase === 'resolved' && isMyTurn && (
          <button
            onClick={endTurn}
            className="px-6 py-3 rounded-xl bg-beer-700 hover:bg-beer-800 text-white font-bold shadow-lg"
          >
            ⏭ {t('play.endTurn')}
          </button>
        )}

        {!isMyTurn &&
          phase !== 'awaiting-host-pick' &&
          phase !== 'awaiting-drawer-pick' && (
            <div className="px-4 py-2 rounded-lg bg-beer-100 text-beer-700 text-sm flex items-center">
              {t('play.notYourTurn')}
            </div>
          )}
      </div>

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
