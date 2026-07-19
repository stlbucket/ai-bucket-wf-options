<script setup lang="ts">
const { data: applications } = await useSiteAdminApplications()
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Applications" :subtitle="`${(applications ?? []).length} registered applications`" />
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <ApplicationList :applications="applications ?? []" />
    </div>
  </div>
</template>
