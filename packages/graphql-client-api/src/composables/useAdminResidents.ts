import { computed } from 'vue'
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
  useTenantResidentsQuery,
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
