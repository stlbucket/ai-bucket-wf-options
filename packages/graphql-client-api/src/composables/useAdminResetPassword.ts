import { useTriggerWorkflow } from './useTriggerWorkflow'

// Tenant-admin "send password reset" action (password-self-service spec, admin-reset.data.md).
// Dispatches through the engine-agnostic triggerWorkflow surface — the trigger plugin gates
// p:app-admin for the 'forgot-password' key. Fires the SAME n8n forgot-password workflow the public
// home-page route hits (search ZITADEL by email -> password_reset -> set-password email); the admin
// never sets/learns the password. The email must be one the admin is already RLS-authorized to see
// on the user detail page. Fire-and-forget — the email is the evidence; an unknown email no-ops.
export function useAdminResetPassword() {
  const { triggerWorkflow, fetching } = useTriggerWorkflow()

  async function reset(email: string) {
    const res = await triggerWorkflow('forgot-password', { email })
    if (!res.accepted) throw new Error('Password reset was not accepted')
    return res
  }

  return { reset, fetching }
}
