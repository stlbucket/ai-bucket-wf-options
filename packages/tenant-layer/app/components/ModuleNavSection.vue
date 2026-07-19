<script setup lang="ts">
import { useRoute } from 'nuxt/app'
import type { NavSection } from '../composables/useAppNav'

defineProps<{ section: NavSection; collapsed?: boolean }>()

const route = useRoute()

// Highlight the active tool, and keep it highlighted on nested routes
// (e.g. /tools/todo stays active on /tools/todo/[id]).
function isActive(itemRoute: string) {
  return route.path === itemRoute || route.path.startsWith(itemRoute + '/')
}
</script>

<template>
  <div class="flex flex-col gap-0.5" :class="collapsed ? 'items-center' : ''">
    <div
      v-if="!collapsed"
      class="px-2.5 pt-2 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white/45"
    >
      {{ section.label }}
    </div>

    <template v-if="collapsed">
      <UTooltip
        v-for="item in section.items"
        :key="item.key"
        :text="item.label"
        :content="{ side: 'right' }"
      >
        <NuxtLink
          :to="item.route"
          :external="true"
          :aria-label="item.label"
          class="flex items-center justify-center rounded-lg p-2.5 transition-colors"
          :class="
            isActive(item.route)
              ? 'bg-white/15 text-white'
              : 'text-white/85 hover:bg-white/8'
          "
        >
          <UIcon :name="item.icon" class="size-5 shrink-0" />
        </NuxtLink>
      </UTooltip>
    </template>

    <template v-else>
      <NuxtLink
        v-for="item in section.items"
        :key="item.key"
        :to="item.route"
        :external="true"
        class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
        :class="
          isActive(item.route)
            ? 'bg-white/15 font-semibold text-white'
            : 'text-white/85 hover:bg-white/8'
        "
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </template>
  </div>
</template>
