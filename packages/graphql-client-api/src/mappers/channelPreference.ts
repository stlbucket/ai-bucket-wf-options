import type { MyChannelPreferencesQuery } from '../generated/fnb-graphql-api'
import type { ChannelPreference, NotificationChannel } from '@function-bucket/fnb-types'

type ChannelPreferenceRow = NonNullable<
  NonNullable<MyChannelPreferencesQuery['channelPreferencesList']>[number]
>

export const toChannelPreference = (f: ChannelPreferenceRow): ChannelPreference => ({
  channel: f.channel as unknown as NotificationChannel,
  enabled: f.enabled,
  destination: f.destination ?? null,
  verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : null,
})
