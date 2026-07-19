// Plain flat shapes for storage.asset. Enum unions mirror the GraphQL enums (UPPERCASE) so
// mappers pass enum values straight through. See .claude/specs/asset-storage/_shared.data.md.

export type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR'
export type AssetStatus = 'ACTIVE' | 'DELETED'

// GraphQL read shape (mapped from AssetFragment by toAsset). downloadUrl is the computed
// presign field — NULL until scanStatus === 'CLEAN' (quarantine-first gating);
// storageKey/bucket are hidden from the API and deliberately absent here.
import type { Urn } from '@/urn'

export interface Asset {
  id: string
  tenantId: string
  residentUrn: Urn
  isPublic: boolean
  originalName: string
  extension: string
  contentType: string
  sizeBytes: number
  scanStatus: ScanStatus
  assetStatus: AssetStatus
  downloadUrl: string | null
  tags: string[] // user + system tags; mapper un-Maybes with ?? []
  parentAssetId: string | null // set on derived assets (thumbnails); null on originals
  tenantName: string | null // from the tenant relation; null when not selected
  subjectUrn: Urn | null // stacking: the business object this asset attaches to
  urn: Urn
  createdAt: Date
  updatedAt: Date
}

// Upload response (REST carve-out). Same vocabulary; createdAt is an ISO string on the wire.
export interface AssetMeta {
  id: string
  subjectUrn: string | null // stacking: the business object the upload attached to (urn-registry v2)
  isPublic: boolean
  originalName: string
  extension: string
  contentType: string
  sizeBytes: number
  scanStatus: ScanStatus
  tags: string[] // normalized user tags as recorded at insert
  createdAt: string
}
