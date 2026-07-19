// Thin re-export so Nuxt auto-import resolves useSiteAssets() in storage-app pages (R1).
// The real implementation lives in graphql-client-api; the page never sees the transport.
export { useSiteAssets } from '@function-bucket/fnb-graphql-client-api'
export type { Asset } from '@function-bucket/fnb-types'
