import { computed } from 'vue'
import { useRecentNotificationsQuery } from '../generated/fnb-graphql-api'
import { toNotification } from '../mappers/notification'
import type { Notification } from '@function-bucket/fnb-types'

// Site-admin send-test recent-sends panel (notifications spec, send-test.data.md). Reads the gated
// notify_api.notifications fn (exposed as notifyNotificationsList — smart-tag rename;
// p:app-admin-super enforced in SQL, R12); latest 50, manual refresh only.
export function useRecentNotifications() {
  const { data, fetching, error, executeQuery } = useRecentNotificationsQuery({
    variables: { itemLimit: 50 },
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
