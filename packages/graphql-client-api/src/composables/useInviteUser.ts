import { useTriggerWorkflow } from './useTriggerWorkflow'

// Tenant-admin "Invite User" action (user-invitation spec, admin-invite.data.md). Dispatches
// through the engine-agnostic triggerWorkflow surface — the trigger plugin injects tenantId/
// profileId + gates p:app-admin for the 'invite-user' key (no client-side tenant/profile is sent).
// No bespoke route and no new mutation: the invited resident + the ZITADEL human user + email #1
// are all created inside the invite-user workflow (R22), so nothing the client can call directly
// forges a resident or an invite email. Fire-and-forget — the email + the 'invited' row are the
// evidence.
export interface InviteUserInput {
  displayName: string
  email: string
}

export function useInviteUser() {
  const { triggerWorkflow, fetching } = useTriggerWorkflow()

  async function invite(input: InviteUserInput) {
    const res = await triggerWorkflow('invite-user', {
      displayName: input.displayName,
      email: input.email,
    })
    if (!res.accepted) throw new Error('Invitation was not accepted')
    return res
  }

  return { invite, fetching }
}
