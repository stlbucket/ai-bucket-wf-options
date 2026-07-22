<script setup lang="ts">
import { useAdminResidents } from '~/composables/useAdminResidents'

const { data: residentsData } = useAdminResidents()
const residents = computed(() => residentsData.value ?? [])

// Invite is gated p:app-admin (the same gate the invite-user workflow enforces) — hide, not just
// disable, when the admin lacks it (R13 — client check is a hint; the plugin re-enforces).
const { user } = useAuth()
const canInvite = computed(() => user.value?.permissions?.includes('p:app-admin') ?? false)
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Residents" :subtitle="`${residents.length} residents`">
      <template
        v-if="canInvite"
        #actions
      >
        <InviteUserModal />
      </template>
    </PageHeader>
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <ResidentList :residents="residents" />
    </div>
  </div>
</template>
