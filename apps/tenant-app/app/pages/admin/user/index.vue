<script setup lang="ts">
import { useAdminResidents } from '~/composables/useAdminResidents'

const { data: residentsData } = useAdminResidents()
const residents = computed(() => residentsData.value ?? [])
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Residents" :subtitle="`${residents.length} residents`" />
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <ResidentList :residents="residents" />
    </div>
  </div>
</template>
