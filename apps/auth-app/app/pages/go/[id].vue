<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { parseUrn } from '@function-bucket/fnb-types'
import { assumeResidency } from '~/composables/useLoginFlow'

// OTP login deep-link landing / responder (spec .claude/specs/otp-login/ go.ui.md). A tenant-scoped
// link to a URN element (Todo in v1) lands here (D13 — no assigned recipient). If they're logged in
// we switch to the item's workspace and go; otherwise we offer normal ZITADEL login OR "log in with a
// code": the opener enters their OWN phone/email and, if it belongs to a resident of the link's
// tenant, a one-time code is sent there. All server work is pre-claims (/auth/api/otp/*), not GraphQL.

interface DeepLinkPublic {
  id: string | null
  subjectUrn: string | null
  subjectLabel: string | null
  module: string | null
  expired: boolean
  revoked: boolean
}

const route = useRoute()
const linkId = computed(() => String(route.params.id ?? ''))
const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const { isLoggedIn, user, refreshClaims } = useAuth()
const { $urqlClient } = useNuxtApp() as unknown as {
  $urqlClient: Parameters<typeof assumeResidency>[0]
}
const toast = useToast()

type State = 'loading' | 'dead' | 'choose' | 'switch' | 'no_access'
const state = ref<State>('loading')
const deepLink = ref<DeepLinkPublic | null>(null)
const identifier = ref('') // the opener's own phone/email (D13 self-identify)
const codeSent = ref(false)
const code = ref('')
const busy = ref(false)
const errorMsg = ref<string | null>(null)

// v1 responder route map — mirrors the server-side resolveUrnRoute (todo only).
function urnRoute(urn: string): string {
  const p = parseUrn(urn)
  if (p?.module === 'todo') return `/tenant/tools/todo/${p.id}`
  return '/'
}

const itemLabel = computed(() =>
  deepLink.value?.module === 'todo'
    ? { article: 'a Todo', icon: 'i-lucide-square-check' }
    : { article: 'an item', icon: 'i-lucide-link' },
)

const subjectTenantId = computed(() =>
  deepLink.value?.subjectUrn ? (parseUrn(deepLink.value.subjectUrn)?.tenantId ?? null) : null,
)
const targetResidentId = computed(
  () =>
    user.value?.residencies?.find(
      (r) => r.tenantId === subjectTenantId.value && r.residentId,
    )?.residentId ?? null,
)
const targetTenantName = computed(
  () =>
    user.value?.residencies?.find((r) => r.tenantId === subjectTenantId.value)?.tenantName ??
    'that workspace',
)

onMounted(async () => {
  try {
    const { deepLink: dl } = await $fetch<{ deepLink: DeepLinkPublic }>(
      `${authAppUrl}/api/otp/link`,
      { query: { id: linkId.value } },
    )
    deepLink.value = dl
    if (dl.expired || dl.revoked || !dl.subjectUrn) {
      state.value = 'dead'
      return
    }

    // Already logged in → switch to the item's workspace (or go straight there if same tenant).
    if (isLoggedIn.value && user.value) {
      if (user.value.tenantId === subjectTenantId.value) {
        await navigateTo(urnRoute(dl.subjectUrn), { external: true })
        return
      }
      state.value = targetResidentId.value ? 'switch' : 'no_access'
      return
    }
    state.value = 'choose'
  } catch {
    state.value = 'dead'
  }
})

async function onSendCode() {
  if (!identifier.value.trim()) return
  busy.value = true
  errorMsg.value = null
  try {
    await $fetch(`${authAppUrl}/api/otp/request`, {
      method: 'POST',
      body: { id: linkId.value, identifier: identifier.value.trim() },
    })
    codeSent.value = true
    // Enumeration-safe: the response is identical whether or not the contact matched a resident.
    toast.add({
      title: "If that phone or email belongs to a member of this workspace, we've sent a code.",
      color: 'success',
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    toast.add({
      title: status === 429 ? 'Please wait before requesting another code' : 'Could not send code',
      color: 'error',
    })
  } finally {
    busy.value = false
  }
}

function onUseDifferentContact() {
  codeSent.value = false
  code.value = ''
  errorMsg.value = null
}

async function onVerify() {
  busy.value = true
  errorMsg.value = null
  try {
    const { redirect } = await $fetch<{ redirect: string }>(`${authAppUrl}/api/otp/verify`, {
      method: 'POST',
      body: { id: linkId.value, code: code.value.trim() },
    })
    await navigateTo(redirect, { external: true })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    errorMsg.value =
      status === 403
        ? "You don't have access to this workspace."
        : "That code didn't work. Try again or request a new one."
  } finally {
    busy.value = false
  }
}

async function onSwitchAndView() {
  if (!targetResidentId.value || !deepLink.value?.subjectUrn) return
  busy.value = true
  try {
    await assumeResidency($urqlClient, targetResidentId.value)
    await refreshClaims()
    await navigateTo(urnRoute(deepLink.value.subjectUrn), { external: true })
  } catch {
    toast.add({ title: 'Could not switch workspace', color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <!-- loading -->
      <div
        v-if="state === 'loading'"
        class="flex justify-center py-10 text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        />
      </div>

      <!-- dead link -->
      <template v-else-if="state === 'dead'">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Link unavailable"
          description="This link has expired or is no longer valid."
        />
        <UButton
          block
          class="mt-4"
          @click="navigateTo(`${authAppUrl}/login`, { external: true })"
        >
          Go to sign in
        </UButton>
      </template>

      <!-- logged in, no residency in the item's tenant -->
      <template v-else-if="state === 'no_access'">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-lock"
          title="No access"
          description="You don't have access to this workspace."
        />
      </template>

      <!-- logged in, different workspace -->
      <template v-else-if="state === 'switch'">
        <div class="space-y-4">
          <p class="text-sm">
            <span class="font-medium">{{ deepLink?.subjectLabel || itemLabel.article }}</span>
            is in <span class="font-medium">{{ targetTenantName }}</span>.
          </p>
          <UButton
            block
            :loading="busy"
            @click="onSwitchAndView"
          >
            Switch &amp; view
          </UButton>
          <UButton
            block
            variant="ghost"
            color="neutral"
            @click="navigateTo('/', { external: true })"
          >
            Not now
          </UButton>
        </div>
      </template>

      <!-- not logged in: choose ZITADEL or a code -->
      <template v-else>
        <div class="space-y-5">
          <div class="text-center">
            <UIcon
              :name="itemLabel.icon"
              class="size-8 text-primary"
            />
            <h1 class="mt-2 text-lg font-semibold">
              You've been sent {{ itemLabel.article }}
            </h1>
            <p
              v-if="deepLink?.subjectLabel"
              class="text-muted"
            >
              {{ deepLink.subjectLabel }}
            </p>
          </div>

          <LoginForm :return-to="`/auth/go/${linkId}`" />

          <div class="text-center text-xs uppercase text-muted">
            or
          </div>

          <div
            v-if="!codeSent"
            class="space-y-2"
          >
            <UFormField label="Your phone or email">
              <UInput
                v-model="identifier"
                placeholder="you@example.com or +1 555 000 1234"
                class="w-full"
                autocomplete="username"
                @keyup.enter="onSendCode"
              />
            </UFormField>
            <UButton
              block
              variant="outline"
              icon="i-lucide-key-round"
              :loading="busy"
              :disabled="!identifier.trim()"
              @click="onSendCode"
            >
              Log in with a code
            </UButton>
            <p class="text-center text-xs text-muted">
              Enter the phone or email you use with this workspace and we'll send you a code.
            </p>
          </div>

          <div
            v-else
            class="space-y-3"
          >
            <UFormField label="Enter the code we sent you">
              <UInput
                v-model="code"
                placeholder="123456"
                class="w-full text-center font-mono tracking-widest"
                inputmode="numeric"
                autocomplete="one-time-code"
              />
            </UFormField>
            <UAlert
              v-if="errorMsg"
              color="error"
              variant="soft"
              :description="errorMsg"
            />
            <UButton
              block
              :loading="busy"
              @click="onVerify"
            >
              Verify &amp; continue
            </UButton>
            <div class="flex justify-between">
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                :disabled="busy"
                @click="onSendCode"
              >
                Resend code
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                :disabled="busy"
                @click="onUseDifferentContact"
              >
                Use a different phone/email
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>
