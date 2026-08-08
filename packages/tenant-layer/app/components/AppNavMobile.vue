<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
import { useRoute } from 'nuxt/app'
import { computed, onMounted } from 'vue'
// Same version source as AppNav.vue — trued up to the release tag by `pnpm do-pre-deploy`.
import { version as appVersion } from '../../package.json'
import { useAppNav } from '../composables/useAppNav'

const route = useRoute()
const { availableSections, navOpen, openNav, closeNav, hydrateSectionState } = useAppNav()
const { isLoggedIn, user, logout } = useAuth()

// Mirrors AppNav.vue's footer initials — keep the two in sync (shared helper only if a third
// call site appears; over-abstraction for two today).
const initials = computed(() => {
  const name = user.value?.displayName?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
})

onMounted(() => hydrateSectionState())

// The first couple of tools double as bottom-bar tabs; the rest live behind Menu.
const primaryItems = computed(() => availableSections.value.flatMap((s) => s.items).slice(0, 2))

function isActive(itemRoute: string) {
  if (itemRoute === '/') return route.path === '/'
  return route.path === itemRoute || route.path.startsWith(itemRoute + '/')
}
</script>

<template>
  <!-- Bottom tab bar — logged-in only (matches the desktop nav; no nav when signed out) -->
  <nav
    v-if="isLoggedIn"
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
    v-if="isLoggedIn"
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
            class="flex flex-col"
            @click="closeNav"
          >
            <span class="flex items-center gap-2.5">
              <FunctionBucketMark color="secondary" :monogram="false" class="size-[26px]" />
              <span class="font-mono text-[15px] font-bold tracking-tight">function-bucket</span>
            </span>
            <!-- pl-9 = the 26px mark + the 10px gap, so the version sits under the wordmark -->
            <span class="mt-1 pl-9 font-mono text-[10px] leading-none text-white/40">
              v{{ appVersion }}
            </span>
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

        <!-- User footer — mirrors the desktop sidebar footer (AppNav.vue): identity + sign out -->
        <div class="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-3">
          <NuxtLink
            href="/auth/profile"
            :external="true"
            class="flex min-w-0 flex-1 items-center gap-2.5"
            @click="closeNav"
          >
            <div
              class="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-blue-900"
            >
              {{ initials }}
            </div>
            <span class="flex-1 truncate text-sm text-white/85">{{ user?.displayName }}</span>
          </NuxtLink>
          <UButton
            icon="i-lucide-log-out"
            variant="ghost"
            aria-label="Sign out"
            class="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
            @click="logout"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
