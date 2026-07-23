import { computed } from 'vue'
import {
  useMyChannelPreferencesQuery,
  useSetChannelPreferenceMutation,
  useVerifyPhoneCodeMutation,
  type NotificationChannel as GenNotificationChannel,
} from '../generated/fnb-graphql-api'
import { toChannelPreference } from '../mappers/channelPreference'
import { useTriggerWorkflow } from './useTriggerWorkflow'
import type { ChannelPreference, NotificationChannel } from '@function-bucket/fnb-types'

// The profile <NotificationPreferences> card (notifications spec, profile-preferences.data.md).
// User-owned preferences: reads go through the RLS-scoped auto list (channelPreferencesList returns
// only the caller's rows); writes/verification through the two-layer notify_api surface. SMS is
// gated on a verified phone (D13) — the OTP request rides the phone-verification workflow (the
// single delivery chokepoint), and in dev the code is read from the SMS-Test log-sink inbox.
export interface VerifyResult {
  verified: boolean
  reason?: string
}

export function useNotificationPreferences() {
  const { data, fetching, error, executeQuery } = useMyChannelPreferencesQuery()
  const { executeMutation: setPref } = useSetChannelPreferenceMutation()
  const { executeMutation: verifyCode } = useVerifyPhoneCodeMutation()
  const { triggerWorkflow } = useTriggerWorkflow()

  const prefs = computed<ChannelPreference[]>(() =>
    (data.value?.channelPreferencesList ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map(toChannelPreference),
  )
  const smsVerified = computed(() =>
    prefs.value.some((p) => p.channel === 'SMS' && p.verifiedAt != null),
  )

  const refresh = () => executeQuery({ requestPolicy: 'network-only' })

  // Upsert one channel's on/off. The DB rejects enabling SMS while unverified (D13) — surfaces as
  // `error`; the UI also disables the switch, so this is belt-and-suspenders.
  async function setEnabled(channel: NotificationChannel, enabled: boolean) {
    const res = await setPref({ channel: channel as unknown as GenNotificationChannel, enabled })
    if (res.error) throw res.error
    refresh()
  }

  // Fire the OTP send (fire-and-forget). profileId is injected from claims by the trigger plugin.
  async function requestPhoneVerification(phone: string) {
    return triggerWorkflow('phone-verification', { phone })
  }

  // Submit the code; on success the SMS preference is marked verified server-side → re-read.
  async function verifyPhoneCode(phone: string, code: string): Promise<VerifyResult> {
    const res = await verifyCode({ phone, code })
    if (res.error) throw res.error
    const json = (res.data?.verifyPhoneCode?.json ?? { verified: false }) as VerifyResult
    if (json.verified) refresh()
    return json
  }

  return {
    prefs,
    smsVerified,
    fetching,
    error,
    setEnabled,
    requestPhoneVerification,
    verifyPhoneCode,
    refresh,
    executeQuery,
  }
}
