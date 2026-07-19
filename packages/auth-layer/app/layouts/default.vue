<template>
  <div class="flex flex-col min-h-screen">
    <header class="flex items-center justify-end px-4 py-2 border-b border-(--ui-border)">
      <ClientOnly><UColorModeButton /></ClientOnly>
    </header>
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
