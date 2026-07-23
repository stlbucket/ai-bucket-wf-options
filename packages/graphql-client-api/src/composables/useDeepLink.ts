import { useCreateDeepLinkMutation } from '../generated/fnb-graphql-api'
import { useTriggerWorkflow } from './useTriggerWorkflow'

// D14 "Send to residents": create the tenant-scoped link, then fire the send-deep-link workflow.
export interface SendDeepLinkInput {
  subjectUrn: string
  subjectLabel?: string | null
  residentIds: string[]
  message: string
  channels: ('email' | 'sms')[]
  senderName?: string | null
  authAppUrl: string // the caller passes runtimeConfig.public.authAppUrl (builds ${…}/go/<id>)
}

// Create a TENANT-SCOPED OTP quick-login deep link to a URN element (spec .claude/specs/otp-login/
// share-link.data.md, D13). No recipient — the link works for any resident of the URN's tenant, who
// self-identifies on the landing page. Returns the new auth.deep_link id; the caller (the tenant-app
// "Copy quick-login link" action) builds `${authAppUrl}/go/<id>`. The DB gate
// (app_api.create_deep_link) requires the caller be an app-user of the URN's own tenant.
//
// NOTE: `useCreateDeepLinkMutation` is produced by codegen from createDeepLink.graphql — run
// `pnpm graphql-api-generate` (PostGraphile up) before this file type-checks / the package builds.
export function useDeepLink() {
  const { executeMutation } = useCreateDeepLinkMutation()
  const { triggerWorkflow } = useTriggerWorkflow()

  async function shareToLink(subjectUrn: string, subjectLabel?: string | null): Promise<string> {
    const res = await executeMutation({ subjectUrn, subjectLabel: subjectLabel ?? null })
    if (res.error) throw res.error
    const id = res.data?.createDeepLink?.uuid
    if (!id) throw new Error('createDeepLink returned no id')
    return id
  }

  // Create the tenant-scoped link, then trigger the send-deep-link workflow — the workflow (as
  // n8n_worker) resolves each selected resident's contact (resolve_send_recipients, tenant-scoped)
  // and loops the send-notification webhook per (resident × channel). Fire-and-forget: the webhook
  // responds immediately, so `count` is the number of residents selected, not a delivered tally.
  async function sendDeepLink(input: SendDeepLinkInput): Promise<{ url: string; count: number }> {
    const id = await shareToLink(input.subjectUrn, input.subjectLabel)
    const url = `${input.authAppUrl}/go/${id}`
    await triggerWorkflow('send-deep-link', {
      deepLinkId: id,
      url,
      subjectLabel: input.subjectLabel ?? null,
      message: input.message,
      residentIds: input.residentIds,
      channels: input.channels,
      senderName: input.senderName ?? null,
    })
    return { url, count: input.residentIds.length }
  }

  return { shareToLink, sendDeepLink }
}
