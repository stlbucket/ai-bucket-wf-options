import { fileTypeFromBuffer } from 'file-type'

// content type → canonical extension (no dot, lowercased). SVG deliberately excluded (XSS carrier).
export const ALLOWED_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
])

// Image content types eligible for AI-tagging (the checkbox is disabled for non-images; the
// endpoint 400s a hand-rolled aiTagsRequested on a non-image). Mirrors the worker's IMAGE_TYPES.
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

// System-reserved tags — never user-suppliable (users must not fake system state). 'thumbnail'
// marks a derived thumbnail child; 'ai-tags-coming-soon' is the v1 AI-tagging stub marker.
export const RESERVED_TAGS = new Set(['thumbnail', 'ai-tags-coming-soon'])

const MAX_TAGS = 20
const MAX_TAG_LEN = 50

// Authoritative server-side normalization of the comma-delimited `tags` field (the UI pre-normalizes
// only as a courtesy). Split on ',', trim, drop empties, dedupe case-insensitively (they're citext).
// Throws on a reserved tag or over-limit input — the caller translates to a 400.
export function normalizeTags(raw: string): string[] {
  if (!raw) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const tag = part.trim()
    if (!tag) continue
    const lower = tag.toLowerCase()
    if (RESERVED_TAGS.has(lower)) throw new Error(`reserved tag not allowed: ${tag}`)
    if (tag.length > MAX_TAG_LEN) throw new Error(`tag exceeds ${MAX_TAG_LEN} chars: ${tag}`)
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(tag)
  }
  if (out.length > MAX_TAGS) throw new Error(`too many tags (max ${MAX_TAGS})`)
  return out
}

// Text types have no reliable magic bytes — skip the sniff for these.
const TEXT_TYPES = new Set(['text/csv', 'text/plain'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v)
}

// Canonical extension for a content type, cross-checked against the filename's extension (defense
// in depth). Throws on mismatch/unsupported — callers translate to a 415.
export function extForContentType(contentType: string, filename?: string): string {
  const canonical = ALLOWED_TYPES.get(contentType)
  if (!canonical) throw new Error(`unsupported content type: ${contentType}`)
  const nameExt = (filename?.split('.').pop() ?? '').toLowerCase()
  const normalized = nameExt === 'jpeg' ? 'jpg' : nameExt
  if (nameExt && normalized !== canonical) {
    throw new Error(`filename extension .${nameExt} does not match content type ${contentType}`)
  }
  return canonical
}

// Magic-byte sniff: the real bytes must agree with the declared content type. Client MIME and
// filename are both untrusted; this rejects e.g. a script-bearing file mislabeled image/png.
export async function assertMagicBytes(buf: Buffer, contentType: string): Promise<void> {
  if (TEXT_TYPES.has(contentType)) return
  const sniffed = await fileTypeFromBuffer(buf)
  const accepted = new Set<string>([contentType])
  // OOXML docx/xlsx are zip containers — file-type may report the generic zip mime.
  if (contentType.includes('openxmlformats')) accepted.add('application/zip')
  if (!sniffed || !accepted.has(sniffed.mime)) {
    throw new Error(
      `content bytes (${sniffed?.mime ?? 'unknown'}) do not match declared type ${contentType}`,
    )
  }
}
