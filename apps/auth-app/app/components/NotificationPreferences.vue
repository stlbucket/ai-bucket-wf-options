<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { NotificationChannel } from '@function-bucket/fnb-types'
import { useNotificationPreferences } from '~/composables/useNotificationPreferences'

// Profile card: choose preferred notification method(s) (notifications spec, profile-preferences.*).
// SMS can only be enabled after the phone is verified (D13); the verify round-trip is inline. In
// dev the code is captured by the log-sink — read it from /tenant/site-admin/sms-test.
const toast = useToast()
const {
  prefs,
  smsVerified,
  fetching,
  error,
  setEnabled,
  requestPhoneVerification,
  verifyPhoneCode,
} = useNotificationPreferences()

const emailEnabled = computed(() => prefs.value.find((p) => p.channel === 'EMAIL')?.enabled ?? false)
const smsEnabled = computed(() => prefs.value.find((p) => p.channel === 'SMS')?.enabled ?? false)
const smsPref = computed(() => prefs.value.find((p) => p.channel === 'SMS'))

type VerifyState = 'idle' | 'sent' | 'verifying'
// E.164 string from <PhoneSegments> ('' while incomplete — the shared segmented input owns entry).
const phone = ref('')
const code = ref('')
const verifyState = ref<VerifyState>('idle')
const busy = ref(false)

// Prefill from the stored SMS destination once preferences load.
watch(
  smsPref,
  (p) => {
    if (p?.destination && !phone.value) phone.value = p.destination
  },
  { immediate: true },
)

async function onToggle(channel: NotificationChannel, enabled: boolean) {
  try {
    await setEnabled(channel, enabled)
    toast.add({ title: 'Preferences updated', color: 'success' })
  } catch {
    toast.add({ title: `Could not update ${channel.toLowerCase()}`, color: 'error' })
  }
}

async function onSendCode() {
  if (!phone.value) {
    toast.add({ title: 'Enter a 10-digit US mobile number', color: 'error' })
    return
  }
  busy.value = true
  try {
    await requestPhoneVerification(phone.value)
    verifyState.value = 'sent'
    toast.add({ title: 'Code sent — check your messages', color: 'success' })
  } catch {
    toast.add({ title: 'Could not send code', color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onVerify() {
  busy.value = true
  verifyState.value = 'verifying'
  try {
    const res = await verifyPhoneCode(phone.value, code.value.trim())
    if (res.verified) {
      verifyState.value = 'idle'
      code.value = ''
      toast.add({ title: 'Phone verified', color: 'success' })
    } else {
      verifyState.value = 'sent'
      toast.add({ title: `Verification failed: ${res.reason ?? 'invalid code'}`, color: 'error' })
    }
  } catch {
    verifyState.value = 'sent'
    toast.add({ title: 'Verification failed', color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <span class="font-medium">How should we reach you?</span>
    </template>

    <UAlert
      v-if="error"
      color="error"
      title="Could not load preferences"
      :description="String(error)"
    />

    <div
      v-else
      class="space-y-4"
    >
      <!-- Email — always available, implicitly verified -->
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-medium">
            Email
          </p>
          <UBadge
            color="success"
            variant="subtle"
            size="sm"
          >
            verified
          </UBadge>
        </div>
        <USwitch
          :model-value="emailEnabled"
          :loading="fetching"
          @update:model-value="(v: boolean) => onToggle('EMAIL', v)"
        />
      </div>

      <!-- SMS — gated on a verified phone (D13) -->
      <div class="border-t border-default pt-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium">
              SMS
            </p>
            <UBadge
              :color="smsVerified ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ smsVerified ? 'verified' : 'unverified' }}
            </UBadge>
          </div>
          <USwitch
            :model-value="smsEnabled"
            :disabled="!smsVerified"
            @update:model-value="(v: boolean) => onToggle('SMS', v)"
          />
        </div>

        <div
          v-if="!smsVerified"
          class="mt-3 space-y-2"
        >
          <UFormField label="Mobile number">
            <PhoneSegments
              v-model="phone"
              :disabled="verifyState !== 'idle'"
            />
          </UFormField>

          <div
            v-if="verifyState === 'idle'"
          >
            <UButton
              icon="i-lucide-message-square-text"
              :loading="busy"
              @click="onSendCode"
            >
              Send code
            </UButton>
          </div>

          <div
            v-else
            class="flex items-end gap-2"
          >
            <UFormField
              label="Verification code"
              class="flex-1"
            >
              <UInput
                v-model="code"
                placeholder="123456"
                class="w-full font-mono"
                inputmode="numeric"
              />
            </UFormField>
            <UButton
              :loading="busy"
              @click="onVerify"
            >
              Verify
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="busy"
              @click="onSendCode"
            >
              Resend
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
