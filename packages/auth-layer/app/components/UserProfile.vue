<script setup lang="ts">
import { computed, type DeepReadonly } from 'vue'
import type { ProfileClaims, ModuleInfo, ToolInfo } from '@function-bucket/fnb-types'

const props = defineProps<{ user: DeepReadonly<ProfileClaims> }>()

const statusColor = (status: string | null) => {
  if (status === 'ACTIVE') return 'success'
  if (status === 'BLOCKED') return 'error'
  return 'warning'
}

const permissions = computed<string[]>(() => {
  return props.user.permissions as string[]
})

const modules = computed<ModuleInfo[]>(() => {
  return (props.user.modules as ModuleInfo[]) ?? []
})
</script>

<template>
  <UCard class="w-full" v-if="user">
    <template #header>
      <div class="flex items-center gap-4">
        <UAvatar :alt="String(user.displayName ?? '')" size="lg" />
        <div>
          <p class="font-semibold text-base">{{ user.displayName }}</p>
          <p class="text-sm text-muted">{{ user.email }}</p>
        </div>
      </div>
    </template>
    <div class="space-y-6 text-sm">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Identity</p>
        <dl class="space-y-3">
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Profile ID</dt>
            <dd class="font-mono text-right truncate">{{ user.profileId }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Email</dt>
            <dd class="text-right">{{ user.email }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Name</dt>
            <dd class="text-right">{{ user.displayName }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Status</dt>
            <dd>
              <UBadge
                v-if="user.profileStatus"
                :color="statusColor(user.profileStatus)"
                variant="subtle"
                size="sm"
              >
                {{ user.profileStatus }}
              </UBadge>
              <span v-else class="text-muted">—</span>
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Tenant</p>
        <dl class="space-y-3">
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Tenant ID</dt>
            <dd class="font-mono text-right truncate">{{ user.tenantId ?? '—' }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Tenant Name</dt>
            <dd class="text-right">{{ user.tenantName ?? '—' }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Resident</p>
        <dl class="space-y-3">
          <div class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Resident ID</dt>
            <dd class="font-mono text-right truncate">{{ user.residentId ?? '—' }}</dd>
          </div>
          <div v-if="user.actualResidentId && user.actualResidentId !== user.residentId" class="flex justify-between gap-4">
            <dt class="text-muted shrink-0">Acting As</dt>
            <dd class="font-mono text-right truncate">{{ user.actualResidentId }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Permissions</p>
        <div v-if="user.permissions && (user.permissions as unknown[]).length > 0" class="flex flex-wrap gap-1">
          <UBadge
            v-for="perm in permissions"
            :key="String(perm)"
            color="neutral"
            variant="outline"
            size="sm"
          >
            {{ perm }}
          </UBadge>
        </div>
        <p v-else class="text-muted">None</p>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Modules</p>
        <div v-if="modules.length" class="flex flex-col divide-y divide-default">
          <div
            v-for="mod in modules"
            :key="String(mod.key)"
            class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2">
                <UIcon v-if="mod.defaultIconKey" :name="String(mod.defaultIconKey)" class="shrink-0" />
                <span class="font-medium">{{ mod.name }}</span>
              </div>
              <span class="font-mono text-muted text-xs">{{ mod.key }}</span>
            </div>
            <div v-if="(mod.tools as ToolInfo[] | null)?.length" class="flex flex-col gap-1 pl-4 border-l-2 border-default">
              <div
                v-for="tool in (mod.tools as ToolInfo[])"
                :key="String(tool.key)"
                class="flex items-center justify-between gap-4"
              >
                <div class="flex items-center gap-2">
                  <UIcon v-if="tool.defaultIconKey" :name="String(tool.defaultIconKey)" class="shrink-0 text-muted" />
                  <span class="text-muted">{{ tool.name }}</span>
                </div>
                <span class="font-mono text-xs text-muted">{{ tool.route }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-muted">None</p>
      </div>
    </div>
  </UCard>
</template>
