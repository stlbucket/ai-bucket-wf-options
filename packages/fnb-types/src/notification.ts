// Notification (fnb-notify) shared vocabulary (R3). Enum values mirror the GraphQL enums verbatim
// (UPPERCASE); timestamps are Date. Spec: .claude/specs/notifications/_shared.data.md.

export type NotificationChannel = 'EMAIL' | 'SMS'

export type NotificationStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'BOUNCED'
  | 'FAILED'

export interface Notification {
  id: string
  channel: NotificationChannel
  status: NotificationStatus
  templateKey: string
  recipient: string
  subject: string | null
  tenantId: string | null
  provider: string | null
  // Template vars captured at send time (NOT the rendered email body — see _shared.data.md). For
  // the SMS log-sink this is the "inbox" content: e.g. { body } for sms-test, { code } for
  // phone-verify. Exposed only on the p:app-admin-super-gated read (notify_api.notifications).
  payload: Record<string, unknown>
  createdAt: Date
  sentAt: Date | null
}

// User's preferred notification method(s) (D12). One per (profile, channel). `enabled` = the user
// picked this method; `verifiedAt` gates SMS (D13 — email is implicitly verified). Backs the
// profile <NotificationPreferences> card. Spec: notifications/_shared.data.md + profile-preferences.*.
export interface ChannelPreference {
  channel: NotificationChannel
  enabled: boolean
  destination: string | null
  verifiedAt: Date | null
}
