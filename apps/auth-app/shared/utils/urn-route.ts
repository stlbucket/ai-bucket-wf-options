import { parseUrn } from '@function-bucket/fnb-types'

// Maps a URN to the in-app route that renders / responds to it — the single route map for the
// OTP deep-link flow (spec docs/specs/otp-login/ D7). Lives in shared/utils so both sides
// auto-import the same resolver: the server OTP verify redirect (server/api/otp/verify.post.ts)
// and the /auth/go landing page's logged-in switch path (app/pages/go/[id].vue). Add entries as
// modules register (approvals, …). Unknown → home.
const ROUTES: Record<string, (id: string) => string> = {
  // tenant-app is served under /tenant; detail pages are app/pages/tools/<module>/[id].vue
  todo: (id) => `/tenant/tools/todo/${id}`,
  poll: (id) => `/tenant/tools/poll/${id}`,
}

export function resolveUrnRoute(urn: string): string {
  const parsed = parseUrn(urn)
  if (!parsed) return '/'
  const build = ROUTES[parsed.module]
  return build ? build(parsed.id) : '/'
}
