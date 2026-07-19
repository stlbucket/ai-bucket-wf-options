import { computed, ref } from 'vue'
import { useAirportMapPointsQuery } from '../generated/fnb-graphql-api'
import { toAirportMapPoint } from '../mappers/airport'

export function useAirportMapPoints() {
  // paused until the map view is first activated — don't fetch ~72k rows
  // for users who never leave the list
  const pause = ref(true)
  const includeClosed = ref(false)
  const variables = computed(() => ({ options: { includeClosed: includeClosed.value } }))
  const { data, fetching, error, executeQuery } = useAirportMapPointsQuery({ variables, pause })

  function activate() {
    pause.value = false
  }

  const points = computed(() =>
    (data.value?.airportMapPointsList ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map(toAirportMapPoint),
  )

  return { points, fetching, error, includeClosed, activate, executeQuery }
}
