import { computed } from 'vue'
import { useClientHandle } from '@urql/vue'
import type {
  License,
  Resident,
  ResidentStatus,
  Tenant,
  TenantSubscription,
} from '@function-bucket/fnb-types'
import { toTenant } from '../mappers/tenant'
import { toResident } from '../mappers/resident'
import { toLicense } from '../mappers/license'
import { toTenantSubscription } from '../mappers/tenant-subscription'
import {
  useActivateWorkspaceMutation,
  useChildWorkspacesQuery,
  useCreateWorkspaceMutation,
  useDeactivateWorkspaceMutation,
  useMyProfileResidenciesQuery,
  useWorkspaceByIdQuery,
} from '../generated/fnb-graphql-api'
import { assumeResidency, ENTERABLE_STATUSES } from './useResidency'

// Composable view types (global-rules R4)

export type WorkspaceView = Tenant & {
  myResidentId: string | null
  myResidentStatus: ResidentStatus | null
  canEnter: boolean
}

export type WorkspaceResidentView = Resident & {
  licenses: License[]
}

export function useWorkspaces() {
  const { client } = useClientHandle()
  const { data, fetching, error, executeQuery } = useChildWorkspacesQuery()
  const { data: residenciesData, executeQuery: executeResidenciesQuery }
    = useMyProfileResidenciesQuery()
  const { executeMutation: execCreate } = useCreateWorkspaceMutation()

  const workspaces = computed<WorkspaceView[]>(() => {
    const residencies = (residenciesData.value?.myProfileResidenciesList ?? []).filter(
      (r): r is NonNullable<typeof r> => r != null,
    )
    return (data.value?.childWorkspacesList ?? [])
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => {
        const tenant = toTenant(t)
        const residency = residencies.find((r) => String(r.tenantId) === tenant.id)
        const myResidentStatus = residency
          ? (residency.status as unknown as ResidentStatus)
          : null
        return {
          ...tenant,
          myResidentId: residency ? String(residency.id) : null,
          myResidentStatus,
          canEnter:
            residency != null
            && tenant.status === 'ACTIVE'
            && myResidentStatus != null
            && ENTERABLE_STATUSES.includes(myResidentStatus),
        }
      })
  })

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
    executeResidenciesQuery({ requestPolicy: 'network-only' })
  }

  async function createWorkspace(name: string, identifier?: string): Promise<Tenant> {
    const result = await execCreate({ name, identifier: identifier || undefined })
    if (result.error) throw result.error
    const created = result.data?.createWorkspace?.tenant
    refresh()
    if (!created) throw new Error('createWorkspace returned no tenant')
    return toTenant(created)
  }

  // Switches the active residency; callers follow up with useAuth().refreshClaims()
  // and navigate (see the Enter-Workspace Flow in the workspace spec).
  async function enterWorkspace(residentId: string): Promise<void> {
    await assumeResidency(client, residentId)
  }

  return { workspaces, fetching, error, refresh, createWorkspace, enterWorkspace }
}

export function useWorkspaceDetail(tenantId: string) {
  const { client } = useClientHandle()
  const { data, fetching, error, executeQuery } = useWorkspaceByIdQuery({
    variables: { tenantId },
  })
  const { executeMutation: execDeactivate } = useDeactivateWorkspaceMutation()
  const { executeMutation: execActivate } = useActivateWorkspaceMutation()

  const workspace = computed<Tenant | null>(() => {
    const t = data.value?.tenant
    return t ? toTenant(t) : null
  })

  const residents = computed<WorkspaceResidentView[]>(() =>
    (data.value?.tenant?.residents ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        ...toResident(r),
        licenses: (r.licenses ?? [])
          .filter((l): l is NonNullable<typeof l> => l != null)
          .map(toLicense),
      })),
  )

  const subscriptions = computed<TenantSubscription[]>(() =>
    (data.value?.tenant?.tenantSubscriptions ?? [])
      .filter((s): s is NonNullable<typeof s> => s != null)
      .map(toTenantSubscription),
  )

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  async function deactivateWorkspace(): Promise<void> {
    const result = await execDeactivate({ tenantId })
    if (result.error) throw result.error
    refresh()
  }

  async function activateWorkspace(): Promise<void> {
    const result = await execActivate({ tenantId })
    if (result.error) throw result.error
    refresh()
  }

  async function enterWorkspace(residentId: string): Promise<void> {
    await assumeResidency(client, residentId)
  }

  return {
    workspace,
    residents,
    subscriptions,
    fetching,
    error,
    refresh,
    deactivateWorkspace,
    activateWorkspace,
    enterWorkspace,
  }
}
