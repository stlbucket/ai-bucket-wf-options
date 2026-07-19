// Thin re-export so Nuxt auto-import resolves useAssetDetail() in storage-app pages (R1).
// The real implementation lives in graphql-client-api; the page never sees the transport.
export { useAssetDetail } from '@function-bucket/fnb-graphql-client-api'
export type { AssetDetailView } from '@function-bucket/fnb-graphql-client-api'
// `Asset` is intentionally NOT re-exported here — useSiteAssets.ts already provides it to
// Nuxt auto-import; re-exporting it again triggers a "Duplicated imports Asset" warning.
