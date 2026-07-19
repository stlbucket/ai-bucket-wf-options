<script setup lang="ts">
import { useSiteAdminUsers } from '~/composables/useSiteAdminUsers'

const { data: users } = await useSiteAdminUsers()
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Users" :subtitle="`${(users ?? []).length} platform users`" />
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <UserList :users="users ?? []" />
    </div>
  </div>
</template>
