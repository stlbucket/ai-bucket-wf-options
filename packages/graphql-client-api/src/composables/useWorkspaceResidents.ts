import { computed, type Ref } from 'vue'
import {
  useWorkspaceResidentPoolQuery,
  useSetWorkspaceMembershipMutation,
} from '../generated/fnb-graphql-api'

// One person in the current workspace's tenant tree, with whether they belong to THIS workspace.
// R4 view type — assembled from app_api.workspace_resident_pool (app_fn.workspace_resident_candidate).
export interface WorkspaceResidentCandidate {
  profileId: string
  email: string
  displayName: string
  fullName: string | null
  homeTenantName: string | null
  workspaceResidentId: string | null
  isMember: boolean
}

// `pause` lets a caller (e.g. a modal) hold the pool query until it is actually opened.
export function useWorkspaceResidents(pause?: Ref<boolean>) {
  const { data, fetching, error, executeQuery } = useWorkspaceResidentPoolQuery({
    requestPolicy: 'network-only',
    pause,
  })
  const { executeMutation } = useSetWorkspaceMembershipMutation()

  const candidates = computed<WorkspaceResidentCandidate[]>(() =>
    (data.value?.workspaceResidentPoolList ?? [])
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({
        profileId: String(c.profileId),
        email: c.email ?? '',
        displayName: c.displayName ?? '',
        fullName: c.fullName ?? null,
        homeTenantName: c.homeTenantName ?? null,
        workspaceResidentId: c.workspaceResidentId ? String(c.workspaceResidentId) : null,
        isMember: c.isMember ?? false,
      })),
  )

  async function setMembership(profileId: string, member: boolean) {
    const res = await executeMutation({ profileId, member })
    if (res.error) throw res.error
    executeQuery({ requestPolicy: 'network-only' }) // re-run — there is no `refresh`
  }

  return { candidates, fetching, error, executeQuery, setMembership }
}
