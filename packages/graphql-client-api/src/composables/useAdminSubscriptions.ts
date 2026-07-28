import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type {
  Resident,
  TenantSubscription,
  LicensePack,
  LicensePackLicenseType,
  LicenseType,
  License,
} from '@function-bucket/fnb-types'
import {
  useAdminSubscriptionsQuery,
  useDeactivateTenantSubscriptionMutation,
  useReactivateTenantSubscriptionMutation,
} from '../generated/fnb-graphql-api'
import { toResident } from '../mappers/resident'
import { toTenantSubscription } from '../mappers/tenant-subscription'
import { toLicensePack, toLicensePackLicenseType } from '../mappers/license-pack'
import { toLicenseType } from '../mappers/license-type'
import { toLicense } from '../mappers/license'

// Composite view for a single subscription's detail page — composed from fnb-types entities.
export interface SubscriptionDetail {
  subscription: TenantSubscription
  licensePack: LicensePack | undefined
  licensePackLicenseTypes: LicensePackLicenseType[]
  licenseTypes: LicenseType[]
  licenses: License[]
  residents: Resident[]
}

// tenantId scopes the list to one tenant (normally the caller's claims tenantId): the unfiltered
// tenantSubscriptionsList leans on RLS alone, and super/parent admins see other tenants' rows.
export function useAdminSubscriptions(tenantId: MaybeRefOrGetter<string | null | undefined>) {
  const { data, fetching, error, executeQuery } = useAdminSubscriptionsQuery({
    variables: computed(() => ({ tenantId: toValue(tenantId) })),
    pause: computed(() => !toValue(tenantId)),
  })
  const { executeMutation: execDeactivate } = useDeactivateTenantSubscriptionMutation()
  const { executeMutation: execReactivate } = useReactivateTenantSubscriptionMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const computedData = computed<TenantSubscription[] | null>(() => {
    const subs = data.value?.adminSubscriptions
    if (!subs) return null
    return subs.map(toTenantSubscription)
  })

  async function deactivateSubscription(id: string) {
    await execDeactivate({ tenantSubscriptionId: id })
    refresh()
  }

  async function reactivateSubscription(id: string) {
    await execReactivate({ tenantSubscriptionId: id })
    refresh()
  }

  return { data: computedData, fetching, error, deactivateSubscription, reactivateSubscription }
}

export function useAdminSubscription(
  id: string,
  tenantId: MaybeRefOrGetter<string | null | undefined>,
) {
  const { data, fetching, error, executeQuery } = useAdminSubscriptionsQuery({
    variables: computed(() => ({ tenantId: toValue(tenantId) })),
    pause: computed(() => !toValue(tenantId)),
  })
  const { executeMutation: execDeactivate } = useDeactivateTenantSubscriptionMutation()
  const { executeMutation: execReactivate } = useReactivateTenantSubscriptionMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const computedData = computed<SubscriptionDetail | null>(() => {
    const subs = data.value?.adminSubscriptions
    if (!subs) return null

    const sub = subs.find((s) => String(s.id) === id)
    if (!sub) return null

    const lplt = sub.licensePack?.licensePackLicenseTypes ?? []
    const licenseTypes = lplt
      .map((l) => l.licenseType)
      .filter((lt): lt is NonNullable<typeof lt> => lt != null)
      .map(toLicenseType)

    const residentMap = new Map<string, Resident>()
    for (const l of sub.licensesList) {
      if (l.resident) residentMap.set(String(l.resident.id), toResident(l.resident))
    }
    const residents = Array.from(residentMap.values())

    return {
      subscription: toTenantSubscription(sub),
      licensePack: sub.licensePack ? toLicensePack(sub.licensePack) : undefined,
      licensePackLicenseTypes: lplt.map(toLicensePackLicenseType),
      licenseTypes,
      licenses: sub.licensesList.map(toLicense),
      residents,
    }
  })

  async function deactivateSubscription() {
    await execDeactivate({ tenantSubscriptionId: id })
    refresh()
  }

  async function reactivateSubscription() {
    await execReactivate({ tenantSubscriptionId: id })
    refresh()
  }

  return { data: computedData, fetching, error, deactivateSubscription, reactivateSubscription }
}
