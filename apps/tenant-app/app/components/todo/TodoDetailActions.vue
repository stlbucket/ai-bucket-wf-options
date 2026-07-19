<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  isTemplate: boolean
  pinned: boolean
  todoName: string
}>()

const emit = defineEmits<{
  (e: 'make-template'): void
  (e: 'clone-template'): void
  (e: 'pin'): void
  (e: 'unpin'): void
  (e: 'delete'): void
}>()

const showDeleteConfirm = ref(false)

const items = computed<DropdownMenuItem[][]>(() => [
  [
    props.isTemplate
      ? {
          label: 'Clone from template',
          icon: 'i-lucide-copy-plus',
          onSelect: () => emit('clone-template')
        }
      : {
          label: 'Make template',
          icon: 'i-lucide-copy',
          onSelect: () => emit('make-template')
        },
    props.pinned
      ? { label: 'Unpin', icon: 'i-lucide-pin-off', onSelect: () => emit('unpin') }
      : { label: 'Pin', icon: 'i-lucide-pin', onSelect: () => emit('pin') }
  ],
  [
    {
      label: 'Delete…',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => {
        showDeleteConfirm.value = true
      }
    }
  ]
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-lucide-ellipsis"
      aria-label="More actions"
    />
  </UDropdownMenu>

  <!-- Delete Confirm Modal -->
  <UModal v-model:open="showDeleteConfirm">
    <template #header>
      <h3 class="text-base font-semibold">
        Delete Todo
      </h3>
    </template>
    <template #body>
      <p class="text-sm">
        Are you sure you want to delete <strong>{{ todoName }}</strong>? This cannot be undone.
      </p>
    </template>
    <template #footer>
      <div class="flex gap-2">
        <UButton
          color="error"
          @click="() => { showDeleteConfirm = false; emit('delete') }"
        >
          Delete
        </UButton>
        <UButton
          variant="ghost"
          color="neutral"
          @click="showDeleteConfirm = false"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>
