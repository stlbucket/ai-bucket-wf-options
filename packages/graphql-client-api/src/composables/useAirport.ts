import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import { useAirportQuery } from '../generated/fnb-graphql-api'
import { toAirport, toAirportFrequency, toNavaid, toRunway } from '../mappers/airport'

export function useAirport(id: MaybeRef<string>) {
  const variables = computed(() => ({ id: unref(id) }))
  const { data, fetching, error } = useAirportQuery({ variables })

  const airport = computed(() => {
    const a = data.value?.airport
    return a ? toAirport(a) : null
  })

  // child lists are exposed as separate computeds so the fnb-types Airport entity stays flat
  const runways = computed(() =>
    (data.value?.airport?.runwaysList ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map(toRunway),
  )

  const frequencies = computed(() =>
    (data.value?.airport?.airportFrequenciesList ?? [])
      .filter((f): f is NonNullable<typeof f> => f != null)
      .map(toAirportFrequency),
  )

  const navaids = computed(() =>
    (data.value?.airport?.navaidsByAssociatedAirportIdList ?? [])
      .filter((n): n is NonNullable<typeof n> => n != null)
      .map(toNavaid),
  )

  return { airport, runways, frequencies, navaids, fetching, error }
}
