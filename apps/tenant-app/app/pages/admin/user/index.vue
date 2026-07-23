<script setup lang="ts">
import { useAdminResidents } from '~/composables/useAdminResidents'

const { data: residentsData, executeQuery: refetchResidents } = useAdminResidents()
const residents = computed(() => residentsData.value ?? [])

// Invite is gated p:app-admin (the same gate the invite-user workflow enforces) — hide, not just
// disable, when the admin lacks it (R13 — client check is a hint; the plugin re-enforces).
const { user } = useAuth()
const canInvite = computed(() => user.value?.permissions?.includes('p:app-admin') ?? false)
// Manage Residents is a nested-tenant-only action (needs the spine pool + membership fns).
// It serves all interchangeable nestable node types (workspace/client/organization) identically.
const NESTABLE_TYPES = ['WORKSPACE', 'CLIENT', 'ORGANIZATION']
const isNested = computed(() => NESTABLE_TYPES.includes(user.value?.tenantType ?? ''))

function onRosterChanged() {
  refetchResidents({ requestPolicy: 'network-only' })
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Residents" :subtitle="`${residents.length} residents`">
      <template
        v-if="canInvite"
        #actions
      >
        <div class="flex flex-wrap items-center gap-2">
          <WorkspaceResidentsModal
            v-if="isNested"
            @changed="onRosterChanged"
          />
          <InviteUserModal />
        </div>
      </template>
    </PageHeader>
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <ResidentList :residents="residents" />
    </div>
  </div>
</template>
