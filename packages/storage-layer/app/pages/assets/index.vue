<script setup lang="ts">
import { computed } from 'vue'

// One RLS-scoped page serving both audiences: super-admins see every tenant's assets
// (manage_all_super_admin), everyone else their own tenant's (manage_all_for_tenant).
// Page calls composables only (R1); the uploader owns its own POST (documented R2 exception).
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.permissions?.includes('p:app-admin-super') ?? false)

const { assets, fetching, refresh } = useSiteAssets()

const subtitle = computed(() => {
  const n = assets.value.length
  return isSuperAdmin.value ? `${n} assets across the platform` : `${n} assets`
})

function onUploaded() {
  refresh()
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Assets" :subtitle="subtitle" />

    <!-- Ad-hoc NO_CONTEXT upload — exercises the full upload → quarantine → scan → promote pipeline -->
    <AssetUploader
      context="NO_CONTEXT"
      :owning-entity-id="null"
      @uploaded="onUploaded"
    />

    <div
      v-if="fetching"
      class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted"
    >
      Loading…
    </div>

    <div
      v-else
      class="overflow-hidden rounded-[10px] border border-default bg-default"
    >
      <AssetList :assets="assets" :show-tenant="isSuperAdmin" />
    </div>
  </div>
</template>
