---
name: feedback-nuxt-ui-v4-api
description: Always use Nuxt UI v4 API for ALL UI components — never v3 patterns. Check docs before writing any component.
metadata:
  type: feedback
---

Always reference Nuxt UI v4 documentation before writing or editing any UI component. Never guess or use v3 API patterns.

**Why:** The codebase uses Nuxt UI v4. v3 props, slot names, and event names are silently wrong or cause runtime errors.

**How to apply:** Before using any `U*` component, verify its v4 API at https://ui.nuxt.com/components/<component-name>. When in doubt, check an existing working component in the codebase first.

**UTable-specific rules (most error-prone):**
- Column defs: `accessorKey` (not `key`), `header` (not `label`), `id` for non-data columns. Never `sortable: true`.
- Sorting header: `header: ({ column }) => sortHeader(column, 'Label')` — copy helper from `LicenseList.vue`
- Slot names: `#<columnId>-cell` (not `#<columnId>-data`)
- Inside slots: `row.original.*` (not `row.*`)
- UTable props: `:data` (not `:rows`), `v-model:sorting` + `const sorting = ref([])`
- Imports: `import type { TableColumn } from '@nuxt/ui'` and `import type { Column } from '@tanstack/vue-table'`

**File convention:** `<template>` block before `<script lang="ts" setup>`

**Docs:** https://ui.nuxt.com/components
