import { S3Client } from '@aws-sdk/client-s3'
import { requiredEnv } from './required-env.js'

// graphql-api-app-local S3 client — used for SIGNING ONLY (the downloadUrl presign field).
// It never writes objects; storage-layer owns the upload PutObject and worker-app owns the scan
// pipeline's GetObject/CopyObject/DeleteObject. Presigning is a
// local HMAC operation (no S3 round-trip), so per-row generation in a list query is cheap.
// Deliberate ~15-line duplication of packages/storage-layer/server/lib/s3.ts (infrastructure.md §1e).
//
// IMPORTANT: presign against a BROWSER-reachable **S3 API** endpoint, not the internal Docker
// one and not the CDN. The signed URL is handed to the user's browser, and a SigV4 signature is
// Host-bound, so it must be signed for the host the browser actually hits.
//   dev:  no S3_PRESIGN_ENDPOINT — derive from S3_PUBLIC_BASE_URL, whose dev value is PATH-style
//         (http://localhost:9000/<bucket>), so its origin is a valid S3 API host. (S3_ENDPOINT =
//         http://minio:9000 only resolves inside the compose network.)
//   prod: S3_PRESIGN_ENDPOINT = the regional Spaces/S3 endpoint (browser-reachable). The prod
//         S3_PUBLIC_BASE_URL is VIRTUAL-HOSTED (the CDN host embeds the bucket) — deriving from
//         it made the SDK prepend the bucket again (fnb-assets-prod.fnb-assets-prod.….cdn.…,
//         NXDOMAIN → every asset a placeholder; first-deploy defect). Presigned URLs bypass the
//         CDN by design — query-string auth is origin-only.
const presignEndpoint =
  process.env.S3_PRESIGN_ENDPOINT || new URL(requiredEnv('S3_PUBLIC_BASE_URL')).origin

export const s3 = new S3Client({
  endpoint: presignEndpoint,
  region: requiredEnv('S3_REGION'),
  forcePathStyle: requiredEnv('S3_FORCE_PATH_STYLE') === 'true', // MinIO needs path-style
  credentials: {
    accessKeyId: requiredEnv('S3_ACCESS_KEY'),
    secretAccessKey: requiredEnv('S3_SECRET_KEY')
  }
})
