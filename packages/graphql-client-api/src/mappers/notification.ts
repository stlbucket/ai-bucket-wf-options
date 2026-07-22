import type { RecentNotificationsQuery } from '../generated/fnb-graphql-api'
import type {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '@function-bucket/fnb-types'

type NotificationRow = NonNullable<
  NonNullable<RecentNotificationsQuery['notifyNotificationsList']>[number]
>

export const toNotification = (f: NotificationRow): Notification => ({
  id: String(f.id),
  channel: f.channel as unknown as NotificationChannel,
  status: f.status as unknown as NotificationStatus,
  templateKey: String(f.templateKey),
  recipient: String(f.recipient),
  subject: f.subject ?? null,
  tenantId: f.tenantId ? String(f.tenantId) : null,
  provider: f.provider ?? null,
  createdAt: new Date(f.createdAt),
  sentAt: f.sentAt ? new Date(f.sentAt) : null,
})
