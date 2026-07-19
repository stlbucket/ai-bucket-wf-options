<template>
  <div class="p-6 max-w-5xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold font-mono">admin</h1>
      <p class="text-muted text-sm">manage your tenant</p>
    </div>

    <div
      v-if="adminSections.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <ModuleNavSection
        v-for="s in adminSections"
        :key="s.key"
        :section="s"
      />
    </div>

    <UEmpty
      v-else
      icon="i-lucide-shield-off"
      label="no admin access"
      description="you don't have any admin permissions"
    />
  </div>
</template>

<script setup lang="ts">
const { availableSections } = useAppNav()

const adminSections = computed(() =>
  availableSections.value.filter(s => s.key.includes('admin'))
)
</script>
