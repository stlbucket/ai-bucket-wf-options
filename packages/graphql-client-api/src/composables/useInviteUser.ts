import { useTriggerWorkflow } from './useTriggerWorkflow'

// Admin "Invite User" action (user-invitation spec, admin-invite.data.md). Dispatches through the
// engine-agnostic triggerWorkflow surface — the trigger plugin injects tenantId/profileId from the
// caller's claims + gates p:app-admin for the 'invite-user' key. Invites always land in the
// caller's OWN tenant: a super admin enters support mode to invite into another tenant (the
// targetTenantId pass-through was removed 2026-07-27 by user directive). No bespoke route and no
// new mutation: the invited resident + the ZITADEL human user + email #1 are all created inside
// the invite-user workflow (R22), so nothing the client can call directly forges a resident or an
// invite email.
//
// `mode` (default 'email'): 'email' sends the invitation mail; 'link' skips it — the workflow
// responds synchronously (responseMode lastNode) with the single-use onboarding ceremony URL,
// surfaced here as `InviteUserResult.link`.
export interface InviteUserInput {
  displayName: string
  email: string
  mode?: 'email' | 'link'
}

export interface InviteUserResult {
  accepted: boolean
  link: string | null
  template: 'user-invitation' | 'set-password' | null
}

export function useInviteUser() {
  const { triggerWorkflow, fetching } = useTriggerWorkflow()

  async function invite(input: InviteUserInput): Promise<InviteUserResult> {
    const res = await triggerWorkflow('invite-user', {
      displayName: input.displayName,
      email: input.email,
      ...(input.mode ? { mode: input.mode } : {}),
    })
    if (!res.accepted) throw new Error('Invitation was not accepted')
    // Shape the webhook response defensively — non-object bodies (or fire-and-forget blobs) → nulls.
    const body =
      res.result && typeof res.result === 'object'
        ? (res.result as { link?: unknown; template?: unknown })
        : {}
    const template =
      body.template === 'user-invitation' || body.template === 'set-password'
        ? body.template
        : null
    return {
      accepted: res.accepted,
      link: typeof body.link === 'string' && body.link ? body.link : null,
      template,
    }
  }

  return { invite, fetching }
}
