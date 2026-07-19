<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const px = computed(() => ({ sm: 64, md: 96, lg: 160 })[props.size])
</script>

<template>
  <svg
    :width="px"
    :height="px"
    viewBox="0 0 160 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="function-bucket logo"
  >
    <!-- Handle -->
    <path
      d="M 38,54 Q 80,10 122,54"
      stroke="var(--ui-primary)"
      stroke-width="9"
      stroke-linecap="round"
      fill="none"
    />

    <!-- Bucket body -->
    <path
      d="M 12,58 L 148,58 L 132,148 Q 130,156 122,156 L 38,156 Q 30,156 28,148 Z"
      fill="var(--ui-primary)"
    />

    <!-- Bucket rim -->
    <rect x="10" y="47" width="140" height="14" rx="7" fill="var(--ui-primary)" />

    <!-- Monogram: ƒb (function bucket) -->
    <text
      x="80"
      y="122"
      text-anchor="middle"
      dominant-baseline="alphabetic"
      font-family="Georgia, 'Times New Roman', serif"
      font-style="italic"
      font-weight="bold"
      fill="var(--ui-bg)"
    ><tspan font-size="58" font-weight="normal">ƒ</tspan><tspan font-size="39" dy="10">b</tspan></text>
  </svg>
</template>
