<script lang="ts" setup>
type BreadcrumbItem = {
  id: string
  name: string
}

defineProps<{
  parentChain: BreadcrumbItem[]
}>()
</script>

<template>
  <nav
    v-if="parentChain.length > 0"
    class="flex items-center gap-1 text-xs text-muted flex-wrap"
  >
    <NuxtLink
      to="/tools/todo"
      class="hover:text-primary transition-colors"
    >Todos</NuxtLink>
    <template
      v-for="crumb in parentChain"
      :key="crumb.id"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-3 shrink-0"
      />
      <NuxtLink
        :to="`/tools/todo/${crumb.id}`"
        class="hover:text-primary transition-colors truncate max-w-[12rem]"
      >
        {{ crumb.name }}
      </NuxtLink>
    </template>
    <UIcon
      name="i-lucide-chevron-right"
      class="size-3 shrink-0"
    />
  </nav>
</template>
