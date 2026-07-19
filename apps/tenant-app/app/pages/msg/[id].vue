<script setup lang="ts">
const route = useRoute()
const topicId = route.params.id as string

const { user } = useAuth()
const currentResidentId = computed(() => user.value?.residentId ?? undefined)
</script>

<template>
  <div class="flex flex-col h-full gap-4 max-w-3xl mx-auto">
    <div class="flex items-center gap-2">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        to="/msg"
        size="sm"
      >
        Messages
      </UButton>
    </div>

    <ClientOnly>
      <Msg
        :topic-id="topicId"
        :current-resident-id="currentResidentId"
        class="flex-1 min-h-0"
      />
    </ClientOnly>
  </div>
</template>
