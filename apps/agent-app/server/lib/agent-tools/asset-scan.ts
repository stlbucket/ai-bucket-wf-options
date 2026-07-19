import crypto from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { toolResult } from '../agent-workflows/types'
import { clamdscanFile } from './clam'
import { agentWorkerQuery } from './pg'
import { s3 } from './s3'
import { thumbnailWebp } from './ffmpeg'

// Asset-scan toolbox (asset-scan.workflow.data.md). The deterministic-tools principle applies
// hardest here: the scan verdict and the promote/purge that follows it are ONE atomic tool —
// the agent routes on the returned verdict but can never produce one, reorder
// promote-before-scan, or move bytes by any other path.

// Mirrors the retired _asset-scan-config IMAGE_TYPES (SVG deliberately excluded upstream).
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const SCAN_RETRIES = 5
const SCAN_BACKOFF_MS = 30_000
const THUMB_MAX_PX = 256
const THUMB_RETRIES = 3
const THUMB_BACKOFF_MS = 3000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface AssetRow {
  id: string
  tenant_id: string
  bucket: string
  storage_key: string
  content_type: string
  scan_status: string
  scan_signature: string | null
  is_public: boolean
}

async function assetForScan(assetId: string): Promise<AssetRow> {
  const res = await agentWorkerQuery<{ result: AssetRow }>(
    'select to_jsonb(storage_fn.asset_for_scan($1::uuid)) as result',
    [assetId]
  )
  return res.rows[0]!.result
}

export const getAsset = tool(
  'get_asset',
  'Load the asset metadata needed to orchestrate a scan: storage key, MIME type, scan status, tenant.',
  { assetId: z.uuid() },
  async ({ assetId }) => {
    const asset = await assetForScan(assetId)
    return toolResult({
      key: asset.storage_key,
      mimeType: asset.content_type,
      scanStatus: asset.scan_status,
      tenantId: asset.tenant_id,
      isImage: IMAGE_TYPES.has(asset.content_type)
    })
  }
)

export const scanAndResolve = tool(
  'scan_and_resolve',
  'The atomic scan spine: stream the quarantined bytes through ClamAV and apply EXACTLY ONE ' +
    'terminal outcome — clean: promote to the final prefix; infected: purge; error: leave in ' +
    'quarantine. Returns the verdict; idempotent (re-calls report the recorded verdict).',
  { assetId: z.uuid() },
  async ({ assetId }) => {
    const asset = await assetForScan(assetId)

    // Idempotency: already resolved → no-op reporting the recorded verdict (object may be moved).
    if (asset.scan_status !== 'pending') {
      return toolResult({
        verdict: asset.scan_status,
        signature: asset.scan_signature,
        note: 'already-resolved'
      })
    }

    // S3 Get(quarantine) → /tmp (clamdscan --stream needs a local file to stream from).
    const tmpPath = join(tmpdir(), `scan-${assetId}-${crypto.randomUUID()}`)
    try {
      const obj = await s3().send(
        new GetObjectCommand({ Bucket: asset.bucket, Key: asset.storage_key })
      )
      await writeFile(tmpPath, Buffer.from(await obj.Body!.transformToByteArray()))

      // clamd can be slow on first boot (freshclam signature load) — transient retry lives HERE.
      let scan = await clamdscanFile(tmpPath)
      for (let attempt = 1; scan.verdict === 'error' && attempt < SCAN_RETRIES; attempt++) {
        await sleep(SCAN_BACKOFF_MS)
        scan = await clamdscanFile(tmpPath)
      }

      if (scan.verdict === 'clean') {
        // Promote quarantine/ → public|private/ (same suffix); Copy+Delete tolerate re-runs.
        const stillQuarantined = asset.storage_key.startsWith('quarantine/')
        const finalKey = asset.storage_key.replace(
          /^quarantine\//,
          asset.is_public ? 'public/' : 'private/'
        )
        if (stillQuarantined) {
          await s3().send(
            new CopyObjectCommand({
              Bucket: asset.bucket,
              CopySource: `${asset.bucket}/${asset.storage_key}`,
              Key: finalKey
            })
          )
          await s3().send(new DeleteObjectCommand({ Bucket: asset.bucket, Key: asset.storage_key }))
        }
        await agentWorkerQuery(
          'select storage_fn.resolve_asset_scan($1, $2::storage.scan_status, $3, $4)',
          [assetId, 'clean', null, finalKey]
        )
        return toolResult({ verdict: 'clean' })
      }

      if (scan.verdict === 'infected') {
        // Purge the quarantined object; resolve_asset_scan soft-deletes the row.
        await s3().send(new DeleteObjectCommand({ Bucket: asset.bucket, Key: asset.storage_key }))
        await agentWorkerQuery(
          'select storage_fn.resolve_asset_scan($1, $2::storage.scan_status, $3, $4)',
          [assetId, 'infected', scan.signature, null]
        )
        return toolResult({ verdict: 'infected', signature: scan.signature })
      }

      // 'error' — bytes stay in quarantine for operator review.
      await agentWorkerQuery(
        'select storage_fn.resolve_asset_scan($1, $2::storage.scan_status, $3, $4)',
        [assetId, 'error', null, null]
      )
      return toolResult({ verdict: 'error', detail: scan.detail })
    } finally {
      await unlink(tmpPath).catch(() => {})
    }
  }
)

export const makeThumbnail = tool(
  'make_thumbnail',
  'Generate a 256px webp thumbnail as a derived child asset. Refuses unless the asset scanned ' +
    'clean and is an image (checked in-handler). Best-effort — a failure does not affect the asset.',
  { assetId: z.uuid() },
  async ({ assetId }) => {
    const asset = await assetForScan(assetId)
    // Guards live in the handler — never trusted to the agent.
    if (asset.scan_status !== 'clean') {
      throw new Error(`make_thumbnail refused: asset is '${asset.scan_status}', not clean`)
    }
    if (!IMAGE_TYPES.has(asset.content_type)) {
      return toolResult({ note: 'not-an-image', contentType: asset.content_type })
    }

    // Child key lands in the parent's FINAL directory: <prefix>/<dir>/<thumbId>.webp
    const parentKey = asset.storage_key
    const dir = parentKey.slice(0, parentKey.lastIndexOf('/'))
    const thumbId = crypto.randomUUID()
    const childKey = `${dir}/${thumbId}.webp`

    let lastErr: unknown
    for (let attempt = 1; attempt <= THUMB_RETRIES; attempt++) {
      try {
        const obj = await s3().send(
          new GetObjectCommand({ Bucket: asset.bucket, Key: parentKey })
        )
        const source = Buffer.from(await obj.Body!.transformToByteArray())
        const thumb = await thumbnailWebp(source, THUMB_MAX_PX)
        await s3().send(
          new PutObjectCommand({
            Bucket: asset.bucket,
            Key: childKey,
            Body: thumb,
            ContentType: 'image/webp',
            ContentLength: thumb.length
          })
        )
        const checksum = crypto.createHash('sha256').update(thumb).digest('hex')
        // insert_derived_asset is idempotent: an existing 'thumbnail' child is returned instead.
        const inserted = (
          await agentWorkerQuery<{ result: { id: string; storage_key: string } }>(
            'select to_jsonb(storage_fn.insert_derived_asset($1, $2, $3, $4, $5, $6, $7, $8::citext[])) as result',
            [assetId, thumbId, childKey, 'webp', 'image/webp', thumb.length, checksum, ['thumbnail']]
          )
        ).rows[0]!.result
        return toolResult({ derivedAssetId: inserted.id, key: inserted.storage_key })
      } catch (e) {
        lastErr = e
        if (attempt < THUMB_RETRIES) await sleep(THUMB_BACKOFF_MS * attempt)
      }
    }
    throw new Error(
      `make_thumbnail failed after ${THUMB_RETRIES} attempts: ${(lastErr as Error)?.message ?? lastErr}`
    )
  }
)

export const addAssetTags = tool(
  'add_asset_tags',
  'Append tags to an asset (set-union — re-runs cannot duplicate).',
  { assetId: z.uuid(), tags: z.array(z.string()).min(1) },
  async ({ assetId, tags }) => {
    await agentWorkerQuery('select storage_fn.add_asset_tags($1, $2::citext[])', [assetId, tags])
    return toolResult({ tags })
  }
)
