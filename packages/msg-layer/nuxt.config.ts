import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-tenant-layer'],

  nitro: {
    experimental: { websocket: true },
  },
})
