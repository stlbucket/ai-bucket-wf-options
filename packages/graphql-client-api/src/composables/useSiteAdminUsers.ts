import { computed } from 'vue'
import { toProfile } from '../mappers/profile'
import {
  useAllAppProfilesQuery,
  useSiteUserByIdQuery,
  useUpdateUserStatusMutation,
  useUpdateResidentStatusMutation,
  useUpdateUserMutation,
  ProfileStatus,
  ResidentStatus,
} from '../generated/fnb-graphql-api'

export function useSiteAdminUsers() {
  const { data, fetching, error } = useAllAppProfilesQuery({ variables: {} })
  return {
    data: computed(() => {
      const nodes = data.value?.profiles?.nodes
      if (!nodes) return null
      return nodes.filter((p): p is NonNullable<typeof p> => p != null).map(toProfile)
    }),
    fetching,
    error,
  }
}

export function useSiteAdminUser(id: string) {
  const { data, fetching, error, executeQuery } = useSiteUserByIdQuery({ variables: { id } })
  const { executeMutation: execUserStatus } = useUpdateUserStatusMutation()
  const { executeMutation: execResidentStatus } = useUpdateResidentStatusMutation()
  const { executeMutation: execUpdate } = useUpdateUserMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  async function setStatus(action: 'activate' | 'deactivate' | 'block') {
    const statusMap = {
      activate: ProfileStatus.Active,
      deactivate: ProfileStatus.Inactive,
      block: ProfileStatus.Blocked,
    } as const
    const result = await execUserStatus({ profileId: id, status: statusMap[action] })
    if (result.error) throw result.error
    refresh()
  }

  async function setResidentStatus(residentId: string, action: 'activate' | 'deactivate') {
    const statusMap = {
      activate: ResidentStatus.Active,
      deactivate: ResidentStatus.Inactive,
    } as const
    const result = await execResidentStatus({ residentId, status: statusMap[action] })
    if (result.error) throw result.error
    refresh()
  }

  async function update(body: {
    firstName?: string | null
    lastName?: string | null
    displayName?: string | null
    phone?: string | null
    identifier?: string | null
    isPublic?: boolean
  }) {
    const result = await execUpdate({
      id,
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
      displayName: body.displayName ?? undefined,
      phone: body.phone ?? undefined,
      identifier: body.identifier ?? undefined,
      isPublic: body.isPublic,
    })
    if (result.error) throw result.error
    refresh()
  }

  return {
    // siteUserById is a JSON scalar (SQL function returning to_jsonb) — no GraphQL-typed shape to
    // map to, so it is returned raw. Its values are raw pg strings (lowercase status enums).
    data: computed(() => data.value?.siteUserById ?? null),
    fetching,
    error,
    refresh,
    setStatus,
    setResidentStatus,
    update,
  }
}
