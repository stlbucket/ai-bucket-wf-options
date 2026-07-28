<script setup lang="ts">
import { useSubtreeResidents } from '~/composables/useAdminResidents'

const { user } = useAuth()

// Roll-up: current tenant + entire child subtree, one row per person (grouping in the composable).
const { users, executeQuery: refetchResidents } = useSubtreeResidents(() => user.value?.tenantId ?? null)

const tenantCount = computed(
  () => new Set(users.value.flatMap((u) => u.tenancies.map((t) => t.tenantId))).size
)
const subtitle = computed(() => {
  const people = `${users.value.length} ${users.value.length === 1 ? 'person' : 'people'}`
  return tenantCount.value > 1 ? `${people} across ${tenantCount.value} tenants` : people
})

// Invite is gated p:app-admin (the same gate the invite-user workflow enforces) — hide, not just
// disable, when the admin lacks it (R13 — client check is a hint; the plugin re-enforces).
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
    <PageHeader title="Residents" :subtitle="subtitle">
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
      <SubtreeResidentList :users="users" />
    </div>
  </div>
</template>
