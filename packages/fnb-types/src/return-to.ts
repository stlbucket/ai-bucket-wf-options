// Post-login return-to guard (auth-app/login.data.md §Return-to). A `returnTo` is a root-relative
// path threaded through the ZITADEL ceremony so a deep-link opener lands back where they started.
// Open-redirect safe / fail-closed: only a single-leading-slash, same-origin relative path passes —
// never `//host` (protocol-relative), never `\host`, never an absolute URL. Validated at BOTH park
// time (oidc/login) and consume time (login.vue) — defense in depth. A pure helper (the same
// spec-authorized runtime exception as parseUrn), usable server- and client-side.

const MAX_RETURN_TO_LENGTH = 2048

// Reject control chars: 0x00–0x1F (incl. CR/LF, which could smuggle a header/redirect) + DEL (0x7F).
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return true
  }
  return false
}

export function isSafeReturnTo(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_RETURN_TO_LENGTH) return false
  // Must be root-relative: exactly one leading slash. Reject protocol-relative (`//`) and
  // backslash tricks (`/\`, `\`) that browsers can normalize into a foreign origin.
  if (value[0] !== '/') return false
  if (value[1] === '/' || value[1] === '\\') return false
  if (hasControlChar(value)) return false
  return true
}
