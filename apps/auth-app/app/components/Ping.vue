<script setup lang="ts">
import { ping } from '@function-bucket/fnb-auth-server'

const message = ref('')
const result = ref<string | null>(null)

function handlePing() {
  result.value = ping(message.value)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">
        Ping
      </h2>
    </template>

    <div class="flex gap-2">
      <UInput
        v-model="message"
        placeholder="Enter a message…"
        class="flex-1"
        @keyup.enter="handlePing"
      />
      <UButton
        label="Ping"
        @click="handlePing"
      />
    </div>

    <UAlert
      v-if="result !== null"
      class="mt-4"
      color="success"
      variant="soft"
      :description="result"
    />
  </UCard>
</template>
