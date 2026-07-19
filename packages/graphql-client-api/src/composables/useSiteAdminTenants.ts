import { computed } from 'vue'
import { toTenant } from '../mappers/tenant'
import {
  useSearchTenantsQuery,
  useTenantByIdQuery,
  useActivateTenantMutation,
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
    fetching,
    error,
    refresh,
    activate,
    deactivate,
    update,
  }
}

export function useBecomeSupport() {
  const { executeMutation } = useBecomeSupportMutation()

  async function becomeSupportForTenant(tenantId: string) {
    const result = await executeMutation({ tenantId })
    if (result.error) throw result.error
  }

  return { becomeSupportForTenant }
}
