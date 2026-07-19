<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { useAppNav } from '../composables/useAppNav'

const route = useRoute()
const { availableSections, navOpen, openNav, closeNav } = useAppNav()
const { isLoggedIn } = useAuth()

// The first couple of tools double as bottom-bar tabs; the rest live behind Menu.
const primaryItems = computed(() => availableSections.value.flatMap((s) => s.items).slice(0, 2))

function isActive(itemRoute: string) {
  if (itemRoute === '/') return route.path === '/'
  return route.path === itemRoute || route.path.startsWith(itemRoute + '/')
}
</script>

<template>
  <!-- Bottom tab bar -->
  <nav
    class="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-default bg-default lg:hidden"
  >
    <NuxtLink
      to="/"
      :external="true"
      class="flex flex-1 flex-col items-center gap-0.5 py-2"
      :class="isActive('/') ? 'text-primary' : 'text-muted'"
    >
      <UIcon name="i-lucide-layout-grid" class="size-[22px]" />
      <span class="text-[10px]">Home</span>
    </NuxtLink>

    <NuxtLink
      v-for="item in primaryItems"
      :key="item.key"
      :to="item.route"
      :external="true"
      class="flex flex-1 flex-col items-center gap-0.5 py-2"
      :class="isActive(item.route) ? 'text-primary' : 'text-muted'"
    >
      <UIcon :name="item.icon" class="size-[22px]" />
      <span class="text-[10px] truncate max-w-full px-1">{{ item.label }}</span>
    </NuxtLink>

    <button
      type="button"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted"
      @click="openNav"
    >
      <UIcon name="i-lucide-menu" class="size-[22px]" />
      <span class="text-[10px]">Menu</span>
    </button>

    <NuxtLink
      v-if="isLoggedIn"
      href="/auth/profile"
      :external="true"
      class="flex flex-1 flex-col items-center gap-0.5 py-2"
      :class="isActive('/auth/profile') ? 'text-primary' : 'text-muted'"
    >
      <UIcon name="i-lucide-user" class="size-[22px]" />
      <span class="text-[10px]">Profile</span>
    </NuxtLink>
  </nav>

  <!-- Full-nav drawer (dark, reuses the sidebar sections) -->
  <USlideover
    v-model:open="navOpen"
    side="left"
    :ui="{ content: 'max-w-[280px] bg-blue-900 text-white divide-white/10' }"
  >
    <template #content>
      <div class="flex h-full flex-col gap-4 p-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3.5">
          <NuxtLink
            to="/"
            :external="true"
            class="flex items-center gap-2.5"
            @click="closeNav"
          >
            <FunctionBucketMark color="secondary" :monogram="false" class="size-[26px]" />
            <span class="font-mono text-[15px] font-bold tracking-tight">function-bucket</span>
          </NuxtLink>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            aria-label="Close menu"
            class="text-white/70 hover:bg-white/10 hover:text-white"
            @click="closeNav"
          />
        </div>
        <WorkspaceSwitcher />
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
          <ModuleNavSection v-for="s in availableSections" :key="s.key" :section="s" />
          <p v-if="availableSections.length === 0" class="px-2.5 py-4 text-sm text-white/50">
            No menu sections available.
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
