import { computed } from 'vue'
import type { Resident } from '@function-bucket/fnb-types'
import { useTenantLicensesQuery } from '../generated/fnb-graphql-api'
import { toResident } from '../mappers/resident'
import { toLicense } from '../mappers/license'

export function useAdminLicenses() {
  const { data, fetching, error } = useTenantLicensesQuery()

  const computedData = computed(() => {
    const rawItems = data.value?.tenantLicenses
    if (!rawItems) return null

    const raw = rawItems.filter((l): l is NonNullable<typeof l> => l != null)

    const licenses = raw.map(toLicense)

    const residentMap = new Map<string, Resident>()
    for (const l of raw) {
      if (l.resident) residentMap.set(String(l.resident.id), toResident(l.resident))
    }
    const residents = Array.from(residentMap.values())

    return { licenses, residents }
  })

  return { data: computedData, fetching, error }
}
