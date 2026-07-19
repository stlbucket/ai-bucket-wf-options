<template>
  <div />
</template>

<script setup lang="ts">
const { isLoggedIn, goHome } = useAuth()

if (isLoggedIn.value) {
  await goHome()
} else {
  await navigateTo('/login')
}
</script>
