import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type { BattleshipPlayerView } from '@function-bucket/fnb-types'
import type { GameEvent, GameSummary, SeatOutcome } from '@function-bucket/fnb-types'
import {
  useGameByIdQuery,
  useGameViewAtQuery,
  useResignGameMutation,
  useSubmitEventMutation,
} from '../generated/fnb-graphql-api'
import { toGameEvent, toGameSummary } from '../mappers/game'
import { useTriggerWorkflow } from './useTriggerWorkflow'

export interface GameBoardEvent {
  kind: 'hit' | 'miss' | 'sunk' | 'rejected'
  message: string
}

// The battleship detail page (battleship-[id].data.md). Hybrid (useMsgTopic precedent):
// GraphQL load + WS-driven network-only refetch of the LIVE state — no REST carve-out
// (README locked decision: whole-state GraphQL refetch replaces msg's incremental read).
// Ships the v1 replay scrubber (locked decision) on top of the same game_view function.
export function useGame(gameId: MaybeRefOrGetter<string>, myResidentUrn: MaybeRefOrGetter<string | null>) {
  const id = toRef(() => toValue(gameId))

  const { data, fetching, error, executeQuery } = useGameByIdQuery({ variables: computed(() => ({ id: id.value })) })
  const { executeMutation: execSubmit } = useSubmitEventMutation()
  const { executeMutation: execResign } = useResignGameMutation()
  const { triggerWorkflow } = useTriggerWorkflow()

  const game = computed<GameSummary | null>(() => {
    const g = data.value?.game
    return g
      ? toGameSummary({
          id: g.id,
          tenantId: g.tenantId,
          gameTypeId: g.gameTypeId,
          status: g.status,
          seatCount: g.seatCount,
          expectingSeats: g.expectingSeats,
          eventCount: g.eventCount,
          createdAt: g.createdAt,
          finishedAt: g.finishedAt,
          gamePlayersList: g.gamePlayersList,
        })
      : null
  })

  const events = computed<GameEvent[]>(() =>
    (data.value?.game?.gameEventsList ?? [])
      .filter((e): e is NonNullable<typeof e> => e != null && e.eventNumber != null)
      .map(toGameEvent),
  )

  const liveView = computed<BattleshipPlayerView | null>(() => (data.value?.gameView as BattleshipPlayerView | null) ?? null)

  const mySeat = computed<number | null>(() => {
    const urn = toValue(myResidentUrn)
    if (!urn) return null
    return game.value?.players.find((p) => p.residentUrn === urn)?.seat ?? null
  })

  const isExpectingMe = computed(
    () => game.value?.status === 'IN_PROGRESS' && mySeat.value != null && game.value.expectingSeats.includes(mySeat.value),
  )

  const myOutcome = computed<SeatOutcome | null>(
    () => game.value?.players.find((p) => p.seat === mySeat.value)?.outcome ?? null,
  )

  // --- replay scrubber (locked decision: ships in v1) ---
  const replayEvent = ref<number | null>(null)
  const isReplaying = computed(() => replayEvent.value !== null)

  const { data: replayData, executeQuery: executeReplayQuery } = useGameViewAtQuery({
    variables: computed(() => ({ gameId: id.value, eventNumber: replayEvent.value ?? 0 })),
    pause: computed(() => replayEvent.value === null),
  })

  const view = computed<BattleshipPlayerView | null>(() =>
    replayEvent.value === null ? liveView.value : ((replayData.value?.gameView as BattleshipPlayerView | null) ?? null),
  )

  function stepBack() {
    const eventCount = game.value?.eventCount ?? 0
    const next = replayEvent.value === null ? Math.max(1, eventCount - 1) : Math.max(1, replayEvent.value - 1)
    replayEvent.value = next
    executeReplayQuery({ requestPolicy: 'network-only' })
  }
  function stepForward() {
    const eventCount = game.value?.eventCount ?? 0
    if (replayEvent.value === null) return
    if (replayEvent.value >= eventCount) {
      replayEvent.value = null // stepping past the last event returns to live
      return
    }
    replayEvent.value = replayEvent.value + 1
    executeReplayQuery({ requestPolicy: 'network-only' })
  }
  function goLive() {
    replayEvent.value = null
  }

  // --- move-result toasts: derived by diffing consecutive LIVE views (suppressed while
  // replaying) — keeps diff logic + the transport out of components (R1/R2) ---
  const lastEvents = ref<GameBoardEvent[]>([])
  watch(liveView, (next, prev) => {
    if (isReplaying.value || !next || !prev) return
    const found: GameBoardEvent[] = []
    for (let r = 0; r < next.opponent.board.length; r++) {
      for (let c = 0; c < next.opponent.board[r]!.length; c++) {
        const before = prev.opponent.board[r]?.[c]
        const after = next.opponent.board[r]![c]
        if (before === after) continue
        if (after === 'hit') found.push({ kind: 'hit', message: 'Hit!' })
        else if (after === 'sunk') found.push({ kind: 'sunk', message: 'You sank their ship!' })
        else if (after === 'miss') found.push({ kind: 'miss', message: 'Miss' })
      }
    }
    lastEvents.value = found
  })

  // stuck-lobby recovery: re-fire the setup trigger once if we land on a stale lobby game
  // (referee no-ops unless the game is still lobby)
  onMounted(() => {
    setTimeout(() => {
      if (game.value?.status === 'LOBBY') {
        void triggerWorkflow('game-event', { op: 'setup', gameId: id.value })
      }
    }, 5000)
  })

  // WS: LISTEN for game:{id}:state, re-execute the live query network-only on notify
  let ws: WebSocket | null = null
  function connect() {
    if (ws) {
      ws.onclose = null
      ws.close(1000)
      ws = null
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/game/_ws/games/${id.value}`)
    ws.addEventListener('message', () => {
      executeQuery({ requestPolicy: 'network-only' })
    })
    ws.addEventListener('close', (e) => {
      if (e.code !== 1000) setTimeout(connect, 2000)
    })
  }
  onMounted(connect)
  onUnmounted(() => ws?.close(1000, 'unmounted'))

  const submitting = ref(false)

  async function submitEvent(eventData: unknown) {
    if (!isExpectingMe.value || isReplaying.value) return
    submitting.value = true
    try {
      const result = await execSubmit({ gameId: id.value, eventData })
      if (result.error) throw result.error
      await triggerWorkflow('game-event', { op: 'event', gameId: id.value })
    } finally {
      submitting.value = false
    }
  }

  async function resign() {
    const result = await execResign({ gameId: id.value })
    if (result.error) throw result.error
    await triggerWorkflow('game-event', { op: 'event', gameId: id.value })
    executeQuery({ requestPolicy: 'network-only' })
  }

  return {
    game,
    events,
    view,
    liveView,
    mySeat,
    isExpectingMe,
    myOutcome,
    fetching,
    error,
    submitting,
    submitEvent,
    resign,
    replayEvent,
    isReplaying,
    stepBack,
    stepForward,
    goLive,
    lastEvents,
  }
}
