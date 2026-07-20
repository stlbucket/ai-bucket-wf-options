<script setup lang="ts">
// coming-soon.ui.md. Pure presentational (R2).
defineProps<{ title: string; icon: string }>()
</script>

<template>
  <UCard class="max-w-3xl mx-auto">
    <div class="flex flex-col items-center gap-4 py-12 text-center">
      <UIcon :name="icon" class="size-16 text-muted" />
      <h1 class="text-xl font-semibold">{{ title }}</h1>
      <UBadge color="info" size="lg">Coming Soon</UBadge>
      <p class="text-muted">This game isn't ready yet — check back soon.</p>
      <UButton variant="ghost" icon="i-lucide-arrow-left" to="/tenant/games/battleship">
        Back to Battleship
      </UButton>
    </div>
  </UCard>
</template>
