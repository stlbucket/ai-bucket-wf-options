<script setup lang="ts">
import { useSiteAdminUsers } from '~/composables/useSiteAdminUsers'

const PAGE_SIZE = 25

const searchInput = ref('')
const searchTerm = ref('')
const page = ref(1)

// Debounce the raw input into the server-side term; any change restarts at page 1.
let debounce: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    searchTerm.value = value
    page.value = 1
  }, 300)
})

const { users, totalCount, pageCount, fetching } = useSiteAdminUsers({
  searchTerm,
  page,
  pageSize: PAGE_SIZE
})
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Users" :subtitle="`${totalCount} platform users`" />
    <UInput
      v-model="searchInput"
      icon="i-lucide-search"
      placeholder="Search by name, email, or identifier"
      class="w-full sm:w-96"
    />
    <div
      class="overflow-hidden rounded-[10px] border border-default bg-default"
      :class="fetching ? 'opacity-60' : ''"
    >
      <UserList :users="users" />
    </div>
    <div
      v-if="pageCount > 1"
      class="flex justify-end"
    >
      <UPagination
        v-model:page="page"
        :total="totalCount"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </div>
</template>
