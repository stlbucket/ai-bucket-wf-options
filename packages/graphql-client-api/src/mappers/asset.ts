import type { AssetFragment } from '../generated/fnb-graphql-api'
import type { Asset, ScanStatus, AssetStatus, Urn } from '@function-bucket/fnb-types'

// Bridges the internal generated AssetFragment → the shared fnb-types Asset (R3).
// Un-Maybes ids, coerces scalars (UUID→string, Datetime→Date), passes enum values through
// (they already match fnb-types, UPPERCASE). `tenantName` is not on the fragment — it comes from
// the `tenant` relation selected alongside the fragment in AllAssets, so the composable folds it in.
export const toAsset = (f: AssetFragment): Asset => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  residentUrn: String(f.residentUrn) as Urn,
  isPublic: f.isPublic,
  originalName: f.originalName,
  extension: f.extension,
  contentType: f.contentType,
  sizeBytes: Number(f.sizeBytes),
  scanStatus: f.scanStatus as unknown as ScanStatus,
  assetStatus: f.assetStatus as unknown as AssetStatus,
  downloadUrl: f.downloadUrl ?? null,
  tags: (f.tags ?? []).filter((t): t is string => t != null).map(String),
  parentAssetId: f.parentAssetId != null ? String(f.parentAssetId) : null,
  tenantName: null,
  subjectUrn: f.subjectUrn != null ? (String(f.subjectUrn) as Urn) : null,
  urn: String(f.urn) as Urn,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})
