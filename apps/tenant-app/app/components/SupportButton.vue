<script lang="ts" setup>
import type { Tenant } from '@function-bucket/fnb-types'

const props = defineProps<{
  tenant: Tenant
  canSupport?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', tenant: Tenant): void
}>()

const open = ref(false)

function onConfirm() {
  open.value = false
  emit('confirm', props.tenant)
}
</script>

<template>
  <template v-if="canSupport">
    <UButton
      size="sm"
      color="warning"
      variant="outline"
      icon="i-lucide-headset"
      @click="open = true"
    >
      Support
    </UButton>

    <UModal
      :open="open"
      @update:open="open = false"
    >
      <template #header>
        <h3 class="text-base font-semibold">
          Enter Support Mode
        </h3>
      </template>
      <template #body>
        <p class="text-sm">
          You will become a support user in <strong>{{ tenant.name }}</strong>. Your current
          session will be suspended until you exit support mode.
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <UButton
            color="warning"
            @click="onConfirm"
          >
            Confirm
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="open = false"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </template>
</template>
