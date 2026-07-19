<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth';
import { useRouter } from 'nuxt/app';
import { computed, ref } from 'vue';

withDefaults(defineProps<{ profileTo?: string }>(), { profileTo: '/auth/profile' })
const { user, logout, exitSupport } = useAuth()
const router = useRouter()

const isInSupportMode = computed(
  () =>
    user.value?.permissions?.includes('p:exit-support')
)

const exiting = ref(false)
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      v-if="isInSupportMode"
      size="xs"
      color="warning"
      variant="soft"
      icon="i-lucide-log-out"
      :loading="exiting"
      @click="exitSupport"
    >
      Exit Support
    </UButton>
    <NuxtLink :href="profileTo" :external="true">
      <UButton color="neutral" variant="ghost">
        <UAvatar :alt="String(user?.displayName ?? '')" size="xs" class="mr-1" />
        {{ user?.displayName }}
      </UButton>
    </NuxtLink>
    <UButton
      icon="i-lucide-log-out"
      color="neutral"
      variant="ghost"
      aria-label="Sign out"
      @click="logout"
    />
  </div>
</template>
