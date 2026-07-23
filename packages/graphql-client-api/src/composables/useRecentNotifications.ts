import { computed } from 'vue'
import {
  useRecentNotificationsQuery,
  type NotificationChannel as GenNotificationChannel,
} from '../generated/fnb-graphql-api'
import { toNotification } from '../mappers/notification'
import type { Notification, NotificationChannel } from '@function-bucket/fnb-types'

// Site-admin recent-sends panel (notifications spec, send-test.data.md + sms-test.data.md). Reads
// the gated notify_api.notifications fn (exposed as notifyNotificationsList — smart-tag rename;
// p:app-admin-super enforced in SQL, R12); latest 50, manual refresh only. Optional `channel`
// scopes the list (SMS-Test page passes 'SMS' — the log-sink "inbox"; send-test passes none).
export function useRecentNotifications(channel?: NotificationChannel) {
  const { data, fetching, error, executeQuery } = useRecentNotificationsQuery({
    // fnb-types enum values are the GraphQL enum values verbatim (R3) — cast to the generated enum.
    variables: { channel: channel as unknown as GenNotificationChannel, itemLimit: 50 },
  })

  return {
    notifications: computed<Notification[]>(() =>
      (data.value?.notifyNotificationsList ?? [])
        .filter((n): n is NonNullable<typeof n> => n != null)
        .map(toNotification),
    ),
    fetching,
    error,
    refresh: () => executeQuery({ requestPolicy: 'network-only' }),
  }
}
