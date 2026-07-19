<script lang="ts" setup>
import { useUpsertMessageMutation } from '@function-bucket/fnb-graphql-client-api'

const props = defineProps<{ topicId: string }>()

const toast = useToast()
const content = ref('')
const { executeMutation, fetching: sending } = useUpsertMessageMutation()

async function send() {
  if (!content.value.trim()) return
  try {
    const result = await executeMutation({ messageInfo: { topicId: props.topicId, content: content.value } })
    if (result.error) throw result.error
    content.value = ''
  } catch {
    toast.add({ title: 'Failed to send message', color: 'error' })
  }
}
</script>

<template>
  <div class="flex gap-2 pt-2 border-t border-default">
    <UTextarea
      v-model="content"
      placeholder="Write a message…"
      :rows="2"
      class="flex-1"
      @keydown.ctrl.enter="send"
      @keydown.meta.enter="send"
    />
    <UButton
      icon="i-lucide-send"
      :loading="sending"
      :disabled="!content.trim()"
      @click="send"
    />
  </div>
</template>
