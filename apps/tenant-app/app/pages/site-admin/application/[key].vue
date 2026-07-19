<script setup lang="ts">
const route = useRoute()
const { data } = await useSiteAdminApplication(route.params.key as string)

const application = computed(() => data.value?.application)
const modules = computed(() => data.value?.modules ?? [])
const tools = computed(() => data.value?.tools ?? [])
const licenseTypes = computed(() => data.value?.licenseTypes ?? [])

function toolsForModule(moduleKey: string) {
  return tools.value.filter((t) => t.moduleKey === moduleKey)
}
</script>

<template>
  <div class="flex flex-col gap-4 max-w-5xl mx-auto">
    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/site-admin/application"
      size="sm"
    >
      Applications
    </UButton>

    <UCard v-if="application">
      <template #header>
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted">Application</span>
          <h1 class="text-lg font-semibold">
            {{ application.name }}
          </h1>
        </div>
      </template>
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div class="text-muted">
          Key
        </div>
        <div class="font-mono">
          {{ application.key }}
        </div>
        <div class="text-muted">
          Name
        </div>
        <div>{{ application.name }}</div>
      </div>
    </UCard>

    <div class="flex flex-col md:flex-row w-full gap-4">
      <div class="flex flex-col gap-4 w-full">
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted">License Types</span>
              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ licenseTypes.length }}
              </UBadge>
            </div>
          </template>
          <div
            v-if="licenseTypes.length"
            class="flex flex-col divide-y divide-default"
          >
            <div
              v-for="lt in licenseTypes"
              :key="lt.key"
              class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span class="text-sm font-medium font-mono">{{ lt.key }}</span>
                  <span class="text-sm text-muted">{{ lt.displayName }}</span>
                </div>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  {{ lt.assignmentScope }}
                </UBadge>
              </div>
              <div v-if="lt.permissions.length" class="flex flex-wrap gap-1">
                <UBadge
                  v-for="perm in lt.permissions"
                  :key="perm"
                  color="neutral"
                  variant="outline"
                  size="sm"
                >
                  {{ perm }}
                </UBadge>
              </div>
            </div>
          </div>
          <UEmpty v-else icon="i-lucide-key-round" label="No license types." />
        </UCard>
      </div>

      <div class="flex flex-col gap-4 w-full">
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted">Modules</span>
              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ modules.length }}
              </UBadge>
            </div>
          </template>
          <div
            v-if="modules.length"
            class="flex flex-col divide-y divide-default"
          >
            <div
              v-for="mod in modules"
              :key="mod.key"
              class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span class="text-sm font-medium font-mono">{{ mod.key }}</span>
                  <span class="text-sm text-muted">{{ mod.name }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0 text-xs text-muted">
                  <span>ordinal {{ mod.ordinal }}</span>
                </div>
              </div>
              <div
                v-if="toolsForModule(mod.key).length"
                class="flex flex-col gap-1 pl-4 border-l-2 border-default"
              >
                <div
                  v-for="tool in toolsForModule(mod.key)"
                  :key="tool.key"
                  class="flex flex-col gap-1"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex flex-col gap-0.5 min-w-0">
                      <span class="text-xs font-medium font-mono">{{ tool.key }}</span>
                      <span class="text-xs text-muted">{{ tool.name }}</span>
                    </div>
                    <span class="text-xs font-mono text-muted shrink-0">{{ tool.route }}</span>
                  </div>
                  <div v-if="tool.permissionKeys?.length" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="perm in tool.permissionKeys"
                      :key="perm"
                      color="neutral"
                      variant="outline"
                      size="sm"
                    >
                      {{ perm }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <UEmpty v-else icon="i-lucide-blocks" label="No modules." />
        </UCard>
      </div>
    </div>
  </div>
</template>
