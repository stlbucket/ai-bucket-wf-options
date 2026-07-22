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
  createdAt: Date
  sentAt: Date | null
}
