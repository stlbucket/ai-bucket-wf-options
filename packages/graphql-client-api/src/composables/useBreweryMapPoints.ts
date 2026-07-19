import { computed, ref } from 'vue'
import { useBreweryMapPointsQuery } from '../generated/fnb-graphql-api'
import { toBreweryMapPoint } from '../mappers/brewery'

export function useBreweryMapPoints() {
  // paused until the map view is first activated — don't fetch ~11.7k rows
  // for users who never leave the list
  const pause = ref(true)
  const { data, fetching, error, executeQuery } = useBreweryMapPointsQuery({ pause })

  function activate() {
    pause.value = false
  }

  const points = computed(() =>
    (data.value?.breweryMapPointsList ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map(toBreweryMapPoint),
  )

  return { points, fetching, error, activate, executeQuery }
}
