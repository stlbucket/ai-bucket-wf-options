import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  TenantSubscription,
  LicensePack,
  LicensePackLicenseType,
  LicenseType,
} from '@function-bucket/fnb-types'
import {
  useAdminSubscriptionsQuery,
  useBlockResidentMutation,
  useGrantUserLicenseMutation,
  useResidentByIdQuery,
  useRevokeUserLicenseMutation,
  useSubtreeResidentDetailQuery,
  useTenantResidentsQuery,
  useTenantSubtreeResidentsQuery,
  useUnblockResidentMutation,
} from '../generated/fnb-graphql-api'
import { toResident } from '../mappers/resident'
import { toLicense } from '../mappers/license'
import { toTenantSubscription } from '../mappers/tenant-subscription'
import { toLicensePack, toLicensePackLicenseType } from '../mappers/license-pack'
import { toLicenseType } from '../mappers/license-type'

// Composite view for a license pack available to a resident (grant/revoke UI).
export interface SubscriptionPackDetail {
  subscription: TenantSubscription
  licensePack: LicensePack
  licensePackLicenseTypes: LicensePackLicenseType[]
  licenseTypes: LicenseType[]
}

export function useAdminResidents() {
  const { data, fetching, error, executeQuery } = useTenantResidentsQuery()
  return {
    data: computed(() => (data.value?.residents ?? []).map(toResident)),
    fetching,
    error,
    // exposed so pages can refresh the list after out-of-band changes (e.g. workspace roster edits)
    executeQuery,
  }
}

// One residency inside the current tenant's child subtree (roll-up list).
export interface SubtreeTenancy {
  residentId: string
  tenantId: string
  tenantName: string
  tenantType: string
  residentType: string
  status: string // GraphQL enum casing (UPPERCASE)
}

// One person in the roll-up list — flat DB rows grouped by profile. Pending, profile-less
// invites cannot group and stay as their own rows (keyed by resident).
export interface SubtreeUserView {
  key: string
  profileId: string | null
  email: string
  displayName: string
  fullName: string | null
  currentResidentId: string | null
  currentStatus: string | null
  linkResidentId: string
  tenancies: SubtreeTenancy[]
}

export function useSubtreeResidents(currentTenantId: MaybeRefOrGetter<string | null | undefined>) {
  const { data, fetching, error, executeQuery } = useTenantSubtreeResidentsQuery()

  const users = computed<SubtreeUserView[]>(() => {
    const tenantId = toValue(currentTenantId) ?? null
    const rows = (data.value?.tenantSubtreeResidentsList ?? []).filter(
      (r): r is NonNullable<typeof r> => r != null,
    )

    const byKey = new Map<string, SubtreeUserView>()
    for (const r of rows) {
      const key = r.profileId ?? `resident:${r.residentId}`
      const tenancy: SubtreeTenancy = {
        residentId: r.residentId as string,
        tenantId: r.tenantId as string,
        tenantName: r.tenantName ?? '',
        tenantType: r.tenantType ?? '',
        residentType: r.residentType ?? '',
        status: r.residentStatus ?? '',
      }
      const existing = byKey.get(key)
      if (existing) {
        existing.tenancies.push(tenancy)
      } else {
        byKey.set(key, {
          key,
          profileId: r.profileId ?? null,
          email: r.email ?? '',
          displayName: r.displayName ?? '',
          fullName: r.fullName ?? null,
          currentResidentId: null,
          currentStatus: null,
          linkResidentId: tenancy.residentId,
          tenancies: [tenancy],
        })
      }
    }

    for (const user of byKey.values()) {
      // current tenant first, then by tenant name
      user.tenancies.sort((a, b) =>
        a.tenantId === tenantId ? -1
        : b.tenantId === tenantId ? 1
        : a.tenantName.localeCompare(b.tenantName),
      )
      const current = user.tenancies.find((t) => t.tenantId === tenantId)
      if (current) {
        user.currentResidentId = current.residentId
        user.currentStatus = current.status
      }
      user.linkResidentId = current?.residentId ?? user.tenancies[0]!.residentId
    }

    return [...byKey.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
  })

  return { users, fetching, error, executeQuery }
}

// Read-only cross-tenant detail (jsonb — raw pg values, lowercase enum strings). Paused until
// the caller confirms the RLS-scoped ResidentById query missed.
export function useSubtreeResidentDetail(id: string, pause?: Ref<boolean>) {
  const { data, fetching, error } = useSubtreeResidentDetailQuery({
    variables: { residentId: id },
    pause: pause ?? false,
  })
  return {
    data: computed(() => data.value?.subtreeResidentDetail ?? null),
    fetching,
    error,
  }
}

export function useAdminResident(id: string) {
  const {
    data: resData,
    fetching: fetchingRes,
    error,
    executeQuery: execRes,
  } = useResidentByIdQuery({ variables: { residentId: id } })

  const {
    data: subsData,
    fetching: fetchingSubs,
    executeQuery: execSubs,
  } = useAdminSubscriptionsQuery()

  const { executeMutation: execBlock } = useBlockResidentMutation()
  const { executeMutation: execUnblock } = useUnblockResidentMutation()
  const { executeMutation: execGrant } = useGrantUserLicenseMutation()
  const { executeMutation: execRevoke } = useRevokeUserLicenseMutation()

  function refresh() {
    execRes({ requestPolicy: 'network-only' })
    execSubs({ requestPolicy: 'network-only' })
  }

  const data = computed(() => {
    const rawResident = resData.value?.resident
    if (!rawResident) return null

    const resident = toResident(rawResident)
    const licenses = (rawResident.licenses ?? []).map(toLicense)

    const subscriptionPacks: SubscriptionPackDetail[] = (subsData.value?.adminSubscriptions ?? [])
      .filter((s) => !!s.licensePack)
      .map((s) => {
        const lplt = s.licensePack!.licensePackLicenseTypes ?? []
        return {
          subscription: toTenantSubscription(s),
          licensePack: toLicensePack(s.licensePack!),
          licensePackLicenseTypes: lplt.map(toLicensePackLicenseType),
          licenseTypes: lplt
            .map((l) => l.licenseType)
            .filter((lt): lt is NonNullable<typeof lt> => lt != null)
            .map(toLicenseType),
        }
      })

    return { resident, licenses, subscriptionPacks }
  })

  const fetching = computed(() => fetchingRes.value || fetchingSubs.value)

  async function blockResident() {
    await execBlock({ residentId: id })
    refresh()
  }

  async function unblockResident() {
    await execUnblock({ residentId: id })
    refresh()
  }

  async function grantResidentLicense(licenseTypeKey: string) {
    await execGrant({ residentId: id, licenseTypeKey })
    refresh()
  }

  async function revokeResidentLicense(licenseId: string) {
    await execRevoke({ licenseId })
    refresh()
  }

  return {
    data,
    fetching,
    error,
    blockResident,
    unblockResident,
    grantResidentLicense,
    revokeResidentLicense,
  }
}
