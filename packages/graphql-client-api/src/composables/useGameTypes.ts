import { computed } from 'vue'
import type { GameTypeInfo } from '@function-bucket/fnb-types'
import { useGameTypesQuery } from '../generated/fnb-graphql-api'
import { toGameTypeInfo } from '../mappers/game'

// The game-type registry list — powers the New Game modal's machine-kind gating
// (supportedPlayerKinds) and any future Games hub. Reference data (game-server
// _shared.data.md §game_type registry).
export function useGameTypes() {
  const { data, fetching, error, executeQuery } = useGameTypesQuery()

  const gameTypes = computed<GameTypeInfo[]>(() =>
    (data.value?.gameTypesList ?? [])
      .filter((g): g is NonNullable<typeof g> => g != null)
      .map(toGameTypeInfo),
  )

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  return { gameTypes, fetching, error, refresh }
}
