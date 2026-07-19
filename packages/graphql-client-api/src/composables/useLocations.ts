import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import {
  useAllLocationsQuery,
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useUpdateLocationMutation,
  type LocationInfoInput,
} from '../generated/fnb-graphql-api'
import { toLocation } from '../mappers/location'

export function useLocations() {
  const { data, fetching, error, executeQuery } = useAllLocationsQuery()
  const { executeMutation: execCreate } = useCreateLocationMutation()
  const { executeMutation: execDelete } = useDeleteLocationMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const locations = computed(() =>
    (data.value?.locations ?? [])
      .filter((l): l is NonNullable<typeof l> => l != null)
      .map(toLocation),
  )

  async function createLocation(locationInfo: Omit<LocationInfoInput, 'id'>) {
    const result = await execCreate({ locationInfo })
    refresh()
    return result.data?.createLocation?.location ?? null
  }

  async function deleteLocation(locationId: string) {
    await execDelete({ locationId })
    refresh()
  }

  return { locations, fetching, error, createLocation, deleteLocation }
}

export function useLocation(id: MaybeRef<string>) {
  const { data, fetching, error, executeQuery } = useAllLocationsQuery()
  const { executeMutation: execUpdate } = useUpdateLocationMutation()
  const { executeMutation: execDelete } = useDeleteLocationMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const location = computed(() => {
    const list = data.value?.locations ?? []
    const found = list.find((l) => l != null && String(l.id) === String(unref(id)))
    return found ? toLocation(found) : null
  })

  async function updateLocation(fields: Omit<LocationInfoInput, 'id'>) {
    await execUpdate({ locationInfo: { id: unref(id), ...fields } })
    refresh()
  }

  async function deleteLocation() {
    await execDelete({ locationId: unref(id) })
  }

  return { location, fetching, error, updateLocation, deleteLocation }
}
