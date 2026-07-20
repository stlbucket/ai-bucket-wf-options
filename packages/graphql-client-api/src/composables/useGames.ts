import { computed } from 'vue'
import type { MaybeRef } from 'vue'
import { unref } from 'vue'
import type { GameSummary, GameTypeId, NewGamePlayer } from '@function-bucket/fnb-types'
import { useCreateGameMutation, useMyGamesQuery } from '../generated/fnb-graphql-api'
import { toGameSummary } from '../mappers/game'
import { useTriggerWorkflow } from './useTriggerWorkflow'

// The battleship list page (battleship-index.data.md). Not real-time (README locked
// decision) — fetch-on-load + manual refresh.
export function useGames(gameTypeId?: MaybeRef<GameTypeId>) {
  const variables = computed(() => ({ gameTypeId: gameTypeId ? unref(gameTypeId) : null }))
  const { data, fetching, error, executeQuery } = useMyGamesQuery({ variables })
  const { executeMutation: execCreate } = useCreateGameMutation()
  const { triggerWorkflow } = useTriggerWorkflow()

  const games = computed<GameSummary[]>(() =>
    (data.value?.myGamesList ?? [])
      .filter((g): g is NonNullable<typeof g> => g != null)
      .map(toGameSummary),
  )

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  // 1. create the game (seats 2..N; caller becomes seat 1) 2. fire-and-forget the referee's
  // setup trigger 3. refresh the list. Throws on mutation error — the page shows a toast.
  async function createGame(input: { gameTypeId: GameTypeId; players: NewGamePlayer[] }): Promise<string> {
    const result = await execCreate({ gameTypeId: input.gameTypeId, players: input.players })
    if (result.error) throw result.error
    const game = result.data?.createGame?.game
    if (!game) throw new Error('createGame returned no game')
    const gameId = String(game.id)
    await triggerWorkflow('game-event', { op: 'setup', gameId })
    refresh()
    return gameId
  }

  return { games, fetching, error, refresh, createGame }
}
