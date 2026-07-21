import crypto from 'node:crypto'
import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readMultipartFormData,
  setResponseStatus,
} from 'h3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { withClaims } from '@function-bucket/fnb-db-access'
import { isUrn, parseUrn } from '@function-bucket/fnb-types'
import type { AssetMeta } from '@function-bucket/fnb-types'
import { getS3 } from '../lib/s3'
import { requiredEnv } from '../lib/required-env'
import {
  ALLOWED_TYPES,
  IMAGE_TYPES,
  assertMagicBytes,
  extForContentType,
  normalizeTags,
} from '../lib/asset-validation'

const MAX_BYTES = 5 * 1024 * 1024
// Content-length headroom for multipart boundaries + the other small fields, so a valid ~5 MB
// file isn't falsely rejected before parsing. The precise per-file check is step 3.
// Keep in sync with the Caddy request_body max_size (docker/Caddyfile + infra/docker/Caddyfile
// /storage) and the 413 message in useAssetUpload.ts.
const MAX_BODY_BYTES = MAX_BYTES + 1024 * 1024

// Raw storage.asset row (snake_case, no camel-casing on this carve-out). bigint arrives as string.
interface AssetRow {
  id: string
  subject_urn: string | null
  is_public: boolean
  original_name: string
  extension: string
  content_type: string
  size_bytes: string
  tags: string[]
  created_at: Date | string
}

function fieldValue(
  parts: Array<{ name?: string; filename?: string; data: Buffer }>,
  name: string,
): string {
  const p = parts.find((x) => x.name === name && !x.filename)
  return p ? p.data.toString('utf8').trim() : ''
}

export default defineEventHandler(async (event): Promise<AssetMeta> => {
  // 1. AUTH — fast UI hint; the DB re-enforces via storage_api.insert_asset →
  //    jwt.enforce_any_permission(['p:app-admin','p:app-user']). Keep the two in sync.
  const claims = event.context.claims
  if (!claims?.profileId) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  const canUpload = claims.permissions?.some((p) => p === 'p:app-admin' || p === 'p:app-user')
  if (!canUpload) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  if (!claims.tenantId) throw createError({ statusCode: 403, statusMessage: 'No tenant' })

  // Hardening: reject grossly oversized bodies BEFORE readMultipartFormData buffers them into memory.
  // Chunked bodies carry no content-length and would bypass the pre-buffer check, getting fully
  // buffered before the per-file size check; browsers always send content-length for FormData.
  if (getRequestHeader(event, 'transfer-encoding')?.toLowerCase().includes('chunked'))
    throw createError({ statusCode: 411, statusMessage: 'Length required' })
  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'File too large' })

  // 2. PARSE (H3 built-in — no multer)
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Malformed multipart body' })

  const filePart = parts.find((p) => p.name === 'file' && p.filename)
  const isPublic = fieldValue(parts, 'isPublic') === 'true'
  const aiTagsRequested = fieldValue(parts, 'aiTagsRequested') === 'true'
  // Stacking (urn-registry): optional subject the asset attaches to. Existence + caller
  // visibility are enforced in storage_fn.insert_asset (registry guard + FK).
  const subjectUrn = fieldValue(parts, 'subjectUrn') || null
  if (subjectUrn && !isUrn(subjectUrn))
    throw createError({ statusCode: 400, statusMessage: 'Bad subjectUrn' })

  // Server-side normalization is authoritative (UI pre-normalizes as a courtesy). Reserved /
  // over-limit tags throw → 400.
  let tags: string[]
  try {
    tags = normalizeTags(fieldValue(parts, 'tags'))
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: (e as Error).message })
  }

  if (!filePart?.data) throw createError({ statusCode: 400, statusMessage: 'No file' })

  // 3. VALIDATE
  const buf = filePart.data
  if (buf.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'File too large' })
  const contentType = filePart.type ?? 'application/octet-stream'
  if (!ALLOWED_TYPES.has(contentType))
    throw createError({ statusCode: 415, statusMessage: 'Unsupported file type' })

  // AI tagging is image-only. The UI disables the checkbox for non-images, so a non-image + flag is
  // a hand-rolled request — reject, don't silently drop.
  if (aiTagsRequested && !IMAGE_TYPES.has(contentType))
    throw createError({ statusCode: 400, statusMessage: 'AI tags only apply to images' })

  let extension: string
  try {
    extension = extForContentType(contentType, filePart.filename)
    await assertMagicBytes(buf, contentType) // magic bytes must agree with the declared type
  } catch (e) {
    throw createError({ statusCode: 415, statusMessage: (e as Error).message })
  }

  // 4. CHECKSUM
  const checksum = crypto.createHash('sha256').update(buf).digest('hex')

  // 5. QUARANTINE KEY + STORE — no scan here; the asset-scan workflow scans and promotes/purges.
  const assetId = crypto.randomUUID()
  // Key segment groups objects by subject when attached (parseUrn is safe: subjectUrn passed
  // isUrn above). The scan worker's promote is a pure `^quarantine/` prefix swap — key shape
  // is otherwise free.
  const subjectSeg = subjectUrn ? parseUrn(subjectUrn)!.id : assetId
  const bucket = requiredEnv('S3_BUCKET')
  const storageKey = `quarantine/${claims.tenantId}/${subjectSeg}/${assetId}.${extension}`
  const originalName = filePart.filename!

  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buf,
      ContentType: contentType,
      ContentLength: buf.length,
    }),
  )

  // 6. RECORD — one transaction (role authenticated + request.jwt.claims via withClaims).
  //    No wf calls: the scan is fired post-commit against the agent engine (below); a lost
  //    trigger leaves the asset 'pending' and the reaper re-fires it
  //    (agentic-workflow-engine/asset-scan.workflow.data.md → Trigger).
  let row: AssetRow
  try {
    row = await withClaims(claims, async (client) => {
      const inserted = await client.query<AssetRow>(
        `select * from storage_api.insert_asset(
           row(
             $1::uuid, $2::boolean, $3::text, $4::text,
             $5::text, $6::bigint, $7::text, $8::text, $9::text, $10::storage.scan_status, $11::text,
             $12::citext[], $13::text
           )::storage_fn.asset_info
         )`,
        [
          assetId,
          isPublic,
          originalName,
          extension,
          contentType,
          buf.length,
          bucket,
          storageKey,
          checksum,
          'pending',
          null,
          tags,
          subjectUrn,
        ],
      )
      return inserted.rows[0]!
    })
  } catch (err) {
    // The object is already in quarantine/ (orphaned; reaped by the lifecycle rule / reaper).
    console.error('[storage:upload] record failed', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to record upload' })
  }

  // 6b. TRIGGER (post-commit, fire-and-forget) — POST the n8n asset-scan webhook. Failures are
  //     logged and SWALLOWED: the asset stays scan_status='pending' and the reaper owns strays.
  //     (agentic-decommission/asset-scan.workflow.data.md → Trigger.)
  try {
    const response = await fetch(
      `${requiredEnv('N8N_INTERNAL_URL')}/webhook/asset-scan`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-fnb-webhook-secret': requiredEnv('N8N_WEBHOOK_SECRET'),
        },
        body: JSON.stringify({ assetId, tenantId: claims.tenantId, aiTagsRequested }),
      },
    )
    if (!response.ok) {
      console.error(`[storage:upload] asset-scan trigger failed: ${response.status}`)
    }
  } catch (err) {
    console.error('[storage:upload] asset-scan trigger failed (reaper will re-fire)', err)
  }

  // 7. RESPOND — 202 Accepted (AssetMeta; enum values UPPERCASE).
  setResponseStatus(event, 202)
  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  return {
    id: row.id,
    subjectUrn: row.subject_urn,
    isPublic: row.is_public,
    originalName: row.original_name,
    extension: row.extension,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    scanStatus: 'PENDING',
    tags: row.tags ?? [],
    createdAt: createdAt.toISOString(),
  }
})
