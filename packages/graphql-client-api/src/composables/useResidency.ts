import type { Client } from '@urql/vue'
import type { ResidentStatus } from '@function-bucket/fnb-types'
import { AssumeResidentDocument, ExitSupportModeDocument } from '../generated/fnb-graphql-api'
import type {
  AssumeResidentMutation,
  AssumeResidentMutationVariables,
  ExitSupportModeMutation,
  ExitSupportModeMutationVariables,
} from '../generated/fnb-graphql-api'

// Imperative residency/support session operations, mirroring fetchProfileClaims — they run on
// demand (login flow, support toggle) so they take a urql Client rather than being reactive hooks.
// These changed the DB claims, so callers follow up with useAuth().refreshClaims().

// The one definition of "can I assume this residency" — shared by useWorkspaces and the
// workspace switcher (auth-ui). Tenant must also be ACTIVE and the residency not current.
export const ENTERABLE_STATUSES: ResidentStatus[] = ['INVITED', 'ACTIVE', 'INACTIVE', 'SUPPORTING']

export async function assumeResidency(client: Client, residentId: string): Promise<void> {
  const result = await client
    .mutation<AssumeResidentMutation, AssumeResidentMutationVariables>(AssumeResidentDocument, {
      residentId,
    })
    .toPromise()
  if (result.error) throw result.error
}

export async function exitSupportMode(client: Client): Promise<void> {
  const result = await client
    .mutation<ExitSupportModeMutation, ExitSupportModeMutationVariables>(
      ExitSupportModeDocument,
      {},
    )
    .toPromise()
  if (result.error) throw result.error
}
