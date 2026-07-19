import { makeExtendSchemaPlugin, gql } from 'postgraphile/utils'
import { lambda } from 'postgraphile/grafast'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requiredEnv } from '../lib/required-env.js'

const TTL = 15 * 60 // 15 minutes (locked)
const PUBLIC_BASE = requiredEnv('S3_PUBLIC_BASE_URL') // e.g. dev: http://localhost:9000/fnb-assets

// Strip characters that would break the Content-Disposition header value.
function sanitizeHeader(name: string): string {
  return name.replace(/["\\\r\n]/g, '_')
}

// Adds a computed, NULLABLE `downloadUrl` to the `Asset` type.
//   - DELETED (any scan)      → null (soft-deleted; the object is purged anyway)
//   - PENDING/INFECTED/ERROR  → null (quarantine-first gate; object still under quarantine/ anyway)
//   - CLEAN + public          → direct unsigned URL (public/* prefix is anon-readable in MinIO)
//   - CLEAN + private         → short-lived presigned GET, filename restored via Content-Disposition
// The plan can still read storage_key/bucket even though the smart tags hide them from the API —
// the behavior tags affect the exposed schema, not the plan's access to the underlying select.
//
// NOTE: scan_status is compared against the RAW DB enum value ('clean'), not the GraphQL-inflected
// value ('CLEAN'): $asset.get() returns the underlying column value, before enum serialization.
export const AssetDownloadUrlPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Asset {
      downloadUrl: String
    }
  `,
  plans: {
    Asset: {
      downloadUrl($asset: any) {
        // grafast .get() uses the raw DB column names (snake_case), NOT the inflected
        // GraphQL field names — camelCase throws "does not define an attribute named …".
        const $scan = $asset.get('scan_status')
        const $status = $asset.get('asset_status')
        const $public = $asset.get('is_public')
        const $bucket = $asset.get('bucket')
        const $key = $asset.get('storage_key')
        const $name = $asset.get('original_name')
        const $type = $asset.get('content_type')
        return lambda(
          [$scan, $status, $public, $bucket, $key, $name, $type],
          async ([scan, status, isPublic, bucket, key, name, type]: [
            string,
            string,
            boolean,
            string,
            string,
            string,
            string
          ]) => {
            if (status !== 'active') return null // soft-deleted → no URL (object purged anyway)
            if (scan !== 'clean') return null // PENDING/INFECTED/ERROR → no URL
            if (isPublic) return `${PUBLIC_BASE}/${key}` // direct, unsigned, stable
            return getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket: bucket,
                Key: key,
                ResponseContentDisposition: `attachment; filename="${sanitizeHeader(name)}"`,
                ResponseContentType: type
              }),
              { expiresIn: TTL }
            )
          }
        )
      }
    }
  }
}))

export default AssetDownloadUrlPlugin
