import { createError, defineEventHandler, getRouterParam } from 'h3'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { withClaims } from '@function-bucket/fnb-db-access'
import { getS3 } from '../../lib/s3'
import { isUuid } from '../../lib/asset-validation'

// Raw storage.asset row (snake_case; delete carve-out does no camel-casing). Only the fields
// needed to purge the object are typed.
interface DeletedRow {
  id: string
  bucket: string
  storage_key: string
}

// REST carve-out #2: soft-delete + object purge, mirroring the upload endpoint (multipart/
// side-effecting object writes stay off GraphQL; storage_api is deliberately unexposed). The DB
// re-enforces via storage_api.delete_asset (SECURITY INVOKER) — RLS scopes which rows the caller
// may touch (own-tenant + super-admin), so a cross-tenant delete matches 0 rows → 404.
export default defineEventHandler(async (event) => {
  // 1. AUTH — fast UI hint; the DB re-enforces (RLS + jwt.enforce_any_permission).
  const claims = event.context.claims
  if (!claims?.profileId) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  const canDelete = claims.permissions?.some((p) => p === 'p:app-admin' || p === 'p:app-user')
  if (!canDelete) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  if (!claims.tenantId) throw createError({ statusCode: 403, statusMessage: 'No tenant' })

  // 2. VALIDATE the id param.
  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid asset id' })

  // 3. SOFT-DELETE (asset + derived children) under RLS, returning the rows to purge.
  const rows = await withClaims(claims, async (client) => {
    const res = await client.query<DeletedRow>(
      `select id, bucket, storage_key from storage_api.delete_asset($1::uuid)`,
      [id],
    )
    return res.rows
  })

  // Empty ⇒ nothing matched under RLS (not yours / not found / already deleted) → 404 (idempotent).
  if (rows.length === 0) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  // 4. PURGE objects (best-effort; a stranded object is a small accepted risk). Log rejections.
  const s3 = getS3()
  const results = await Promise.allSettled(
    rows.map((r) => s3.send(new DeleteObjectCommand({ Bucket: r.bucket, Key: r.storage_key }))),
  )
  results.forEach((r, i) => {
    if (r.status === 'rejected')
      console.error('[storage:delete] object purge failed', rows[i]?.storage_key, r.reason)
  })

  // 5. RESPOND — 200 { deleted: n }.
  return { deleted: rows.length }
})
