<template>
  <UCard>
    <template #header>
      <h3 class="font-semibold">
        {{ subscriptionPack.licensePack?.displayName ?? subscriptionPack.subscription.licensePackKey }}
      </h3>
    </template>
    <div class="flex flex-col gap-6 sm:flex-row sm:gap-10">
      <div
        v-if="scopedTypes.length"
        class="flex flex-col gap-2 min-w-40"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">
          Scoped
        </p>
        <div class="flex flex-col gap-2">
          <div
            v-for="lt in scopedTypes"
            :key="lt.key"
            class="flex items-center gap-2"
          >
            <URadio
              :model-value="selectedScoped"
              :value="lt.key"
              :label="lt.displayName"
              @update:model-value="onScopedChange(lt.key)"
            />
          </div>
        </div>
      </div>
      <div
        v-if="unscopedTypes.length"
        class="flex flex-col gap-2 min-w-40"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">
          Unscoped
        </p>
        <div class="flex flex-col gap-2">
          <UCheckbox
            v-for="lt in unscopedTypes"
            :key="lt.key"
            :model-value="hasLicense(lt.key)"
            :label="lt.displayName"
            @update:model-value="onUnscopedChange(lt.key)"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>

<script lang="ts" setup>
import type { License } from '@function-bucket/fnb-types'
import type { SubscriptionPackDetail } from '@function-bucket/fnb-graphql-client-api'

const props = defineProps<{
  subscriptionPack: SubscriptionPackDetail
  residentLicenses: License[]
}>()

const emit = defineEmits<{
  (e: 'grant', licenseTypeKey: string): void
  (e: 'revoke', licenseId: string): void
}>()

const UNSCOPED = ['none', 'all']

const scopedTypes = computed(() =>
  props.subscriptionPack.licenseTypes.filter(lt => !UNSCOPED.includes(String(lt.assignmentScope)))
)

const unscopedTypes = computed(() =>
  props.subscriptionPack.licenseTypes.filter(lt => UNSCOPED.includes(String(lt.assignmentScope)))
)

const selectedScoped = computed(() => {
  const scopedKeys = scopedTypes.value.map(lt => lt.key)
  return props.residentLicenses.find(l => scopedKeys.includes(l.licenseTypeKey))?.licenseTypeKey ?? null
})

function hasLicense(licenseTypeKey: string) {
  return props.residentLicenses.some(l => l.licenseTypeKey === licenseTypeKey)
}

function onScopedChange(licenseTypeKey: string) {
  if (selectedScoped.value === licenseTypeKey) return
  const existing = props.residentLicenses.find(l => l.licenseTypeKey === selectedScoped.value)
  if (existing) emit('revoke', existing.id)
  emit('grant', licenseTypeKey)
}

function onUnscopedChange(licenseTypeKey: string) {
  const existing = props.residentLicenses.find(l => l.licenseTypeKey === licenseTypeKey)
  if (existing) {
    emit('revoke', existing.id)
  } else {
    emit('grant', licenseTypeKey)
  }
}
</script>
