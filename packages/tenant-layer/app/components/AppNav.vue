<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
import { useRuntimeConfig } from 'nuxt/app'
import { computed, onMounted, watch } from 'vue'
import { useAppNav } from '../composables/useAppNav'

const { availableSections, navCollapsed, toggleCollapsed } = useAppNav()
const { user, isLoggedIn, logout, exitSupport } = useAuth()
const { public: { authAppUrl } } = useRuntimeConfig()

const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))

const initials = computed(() => {
  const name = user.value?.displayName?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
})

// Read the persisted preference after mount, not during setup — SSR always renders
// expanded, so a setup-time read would mismatch on hydration.
const NAV_COLLAPSED_KEY = 'fnb:nav-collapsed'
onMounted(() => {
  navCollapsed.value = localStorage.getItem(NAV_COLLAPSED_KEY) === '1'
})
watch(navCollapsed, (v) => localStorage.setItem(NAV_COLLAPSED_KEY, v ? '1' : '0'))
</script>

<template>
  <nav
    class="hidden lg:flex sticky top-0 h-screen shrink-0 flex-col gap-4 bg-blue-900 py-5 text-white transition-[width] duration-200"
    :class="navCollapsed ? 'w-16 px-2' : 'w-[232px] px-3.5'"
  >
    <!-- Brand -->
    <NuxtLink
      to="/"
      :external="true"
      class="flex items-center gap-2.5 border-b border-white/10 pb-3.5"
      :class="navCollapsed ? 'justify-center' : 'px-1.5'"
    >
      <FunctionBucketMark color="secondary" :monogram="false" class="size-[26px]" />
      <span v-if="!navCollapsed" class="font-mono text-[15px] font-bold tracking-tight">
        function-bucket
      </span>
    </NuxtLink>

    <!-- Workspace switcher -->
    <WorkspaceSwitcher :collapsed="navCollapsed" />

    <!-- Sections -->
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
      <ModuleNavSection
        v-for="s in availableSections"
        :key="s.key"
        :section="s"
        :collapsed="navCollapsed"
      />
      <p
        v-if="availableSections.length === 0 && !navCollapsed"
        class="px-2.5 py-4 text-sm text-white/50"
      >
        No menu sections available.
      </p>
    </div>

    <!-- User -->
    <div
      class="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3"
      :class="navCollapsed ? 'items-center' : ''"
    >
      <template v-if="navCollapsed">
        <UTooltip v-if="isLoggedIn" :text="user?.displayName ?? 'Profile'" :content="{ side: 'right' }">
          <NuxtLink href="/auth/profile" :external="true" aria-label="Profile">
            <div
              class="flex size-7 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-blue-900"
            >
              {{ initials }}
            </div>
          </NuxtLink>
        </UTooltip>
        <UTooltip v-else text="Sign in" :content="{ side: 'right' }">
          <UButton
            :to="`${authAppUrl}/login`"
            :external="true"
            icon="i-lucide-log-in"
            variant="ghost"
            aria-label="Sign in"
            class="text-white/85 hover:bg-white/10 hover:text-white"
          />
        </UTooltip>
        <ClientOnly>
          <UColorModeButton class="text-white/70 hover:bg-white/10 hover:text-white" />
        </ClientOnly>
        <UTooltip v-if="isInSupportMode" text="Exit Support" :content="{ side: 'right' }">
          <UButton
            size="xs"
            color="warning"
            variant="soft"
            icon="i-lucide-log-out"
            aria-label="Exit Support"
            @click="exitSupport"
          />
        </UTooltip>
        <UTooltip v-if="isLoggedIn" text="Sign out" :content="{ side: 'right' }">
          <UButton
            icon="i-lucide-log-out"
            variant="ghost"
            aria-label="Sign out"
            class="text-white/70 hover:bg-white/10 hover:text-white"
            @click="logout"
          />
        </UTooltip>
        <UTooltip text="Expand navigation" :content="{ side: 'right' }">
          <UButton
            icon="i-lucide-panel-left-open"
            variant="ghost"
            aria-label="Expand navigation"
            class="text-white/70 hover:bg-white/10 hover:text-white"
            @click="toggleCollapsed"
          />
        </UTooltip>
      </template>

      <template v-else>
        <div v-if="isLoggedIn" class="flex items-center gap-2.5 px-1">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-blue-900"
          >
            {{ initials }}
          </div>
          <NuxtLink
            href="/auth/profile"
            :external="true"
            class="flex-1 truncate text-sm text-white/85 hover:text-white"
          >
            {{ user?.displayName }}
          </NuxtLink>
        </div>
        <NuxtLink
          v-else
          :to="`${authAppUrl}/login`"
          :external="true"
          class="px-1 text-sm text-white/85 hover:text-white"
        >
          Sign in
        </NuxtLink>

        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-panel-left-close"
            variant="ghost"
            aria-label="Collapse navigation"
            class="text-white/70 hover:bg-white/10 hover:text-white"
            @click="toggleCollapsed"
          />
          <ClientOnly>
            <UColorModeButton
              class="text-white/70 hover:bg-white/10 hover:text-white"
            />
          </ClientOnly>
          <UButton
            v-if="isInSupportMode"
            size="xs"
            color="warning"
            variant="soft"
            icon="i-lucide-log-out"
            class="ml-1"
            @click="exitSupport"
          >
            Exit Support
          </UButton>
          <UButton
            v-if="isLoggedIn"
            icon="i-lucide-log-out"
            variant="ghost"
            aria-label="Sign out"
            class="ml-auto text-white/70 hover:bg-white/10 hover:text-white"
            @click="logout"
          />
        </div>
      </template>
    </div>
  </nav>
</template>
