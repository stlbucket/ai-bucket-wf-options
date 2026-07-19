<template>
  <div class="max-w-3xl mx-auto p-8 flex flex-col gap-6">
    <UCard>
      <div class="flex flex-col gap-4">
        <h1 class="text-2xl font-bold">
          GraphQL API
        </h1>
        <p class="text-(--ui-text-muted)">
          PostGraphile GraphQL interface for the FNB platform.
        </p>
        <div class="flex gap-3 flex-wrap">
          <UButton
            to="/api/graphql"
            target="_blank"
            color="neutral"
            variant="ghost"
          >
            GraphQL Playground
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
