import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  extends: [
    '@function-bucket/fnb-auth-layer',
    // '@function-bucket/fnb-tenant-layer'
  ]
})
