import { computed } from 'vue'
import type { Tenant } from '@function-bucket/fnb-types'
import { toTenant } from '../mappers/tenant'
import {
  useSearchTenantsQuery,
  useTenantByIdQuery,
  useActivateTenantMutation,
  useCreateTenantMutation,
  useDeactivateTenantMutation,
  useBecomeSupportMutation,
  useUpdateTenantMutation,
} from '../generated/fnb-graphql-api'

export function useSiteAdminTenants() {
  const { data, fetching, error } = useSearchTenantsQuery({ variables: { searchTerm: null } })
  return {
    data: computed(() => {
      const nodes = data.value?.searchTenants?.nodes
      if (!nodes) return null
      return nodes
        .filter((t): t is NonNullable<typeof t> => t != null)
        .map(toTenant)
        // root tenants only — workspaces are managed inside their tenant (Workspaces tool)
        .filter((t) => t.parentTenantId === null)
    }),
    fetching,
    error,
  }
}

// View types for the site-admin tenant detail page (R4 — declared with the composable).
// Statuses/types keep the GraphQL enum casing ('INVITED', 'SUPPORT', …); the UI's statusColor
// normalizes case.
export interface TenantUserView {
  residentId: string
  profileId: string | null
  displayName: string | null
  email: string
  status: string
  type: string
  licenseTypeKeys: string[]
}

export interface TenantSubscriptionView {
  id: string
  licensePackKey: string
  displayName: string | null
  status: string
  licenseCount: number
}

export function useSiteAdminTenant(id: string) {
  const { data, fetching, error, executeQuery } = useTenantByIdQuery({ variables: { tenantId: id } })
  const { executeMutation: execActivate } = useActivateTenantMutation()
  const { executeMutation: execDeactivate } = useDeactivateTenantMutation()
  const { executeMutation: execUpdate } = useUpdateTenantMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  async function activate() {
    const result = await execActivate({ tenantId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function deactivate() {
    const result = await execDeactivate({ tenantId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function update(body: { name?: string; identifier?: string | null; type?: string }) {
    const result = await execUpdate({
      id,
      name: body.name,
      identifier: body.identifier ?? undefined,
      type: body.type as any,
    })
    if (result.error) throw result.error
    refresh()
  }

  return {
    data: computed(() => {
      const t = data.value?.tenant
      return t ? toTenant(t) : null
    }),
    // Support residencies are plumbing, not tenant users; license badges show active licenses only.
    users: computed<TenantUserView[]>(() =>
      (data.value?.tenant?.residents ?? [])
        .filter((r) => r.type !== 'SUPPORT')
        .map((r) => ({
          residentId: String(r.id),
          profileId: r.profileId ? String(r.profileId) : null,
          displayName: r.displayName ?? null,
          email: r.email,
          status: String(r.status),
          type: String(r.type),
          licenseTypeKeys: (r.licenses ?? [])
            .filter((l) => l.status === 'ACTIVE')
            .map((l) => l.licenseTypeKey),
        })),
    ),
    subscriptions: computed<TenantSubscriptionView[]>(() =>
      (data.value?.tenant?.tenantSubscriptions ?? []).map((s) => ({
        id: String(s.id),
        licensePackKey: s.licensePackKey,
        displayName: s.licensePack?.displayName ?? null,
        status: String(s.status),
        licenseCount: s.licenses?.totalCount ?? 0,
      })),
    ),
    fetching,
    error,
    refresh,
    activate,
    deactivate,
    update,
  }
}

// Admin identity for the new tenant: first/last land on a pre-created app.profile (phone
// optional) — see docs/specs/tenant-app/site-admin/tenant/index.data.md
export interface CreateTenantInput {
  name: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
}

export function useCreateTenant() {
  const { executeMutation: execCreate } = useCreateTenantMutation()

  async function createTenant(input: CreateTenantInput): Promise<Tenant> {
    const result = await execCreate({
      name: input.name,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
    })
    if (result.error) throw result.error
    const created = result.data?.createTenant?.tenant
    if (!created) throw new Error('createTenant returned no tenant')
    return toTenant(created)
  }

  return { createTenant }
}

export function useBecomeSupport() {
  const { executeMutation } = useBecomeSupportMutation()

  async function becomeSupportForTenant(tenantId: string) {
    const result = await executeMutation({ tenantId })
    if (result.error) throw result.error
  }

  return { becomeSupportForTenant }
}
