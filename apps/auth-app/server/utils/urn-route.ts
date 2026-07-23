import { parseUrn } from '@function-bucket/fnb-types'

// Maps a URN to the in-app route that renders / responds to it, for the OTP landing redirect.
// v1: Todos only (spec .claude/specs/otp-login/ D7). Add entries as modules register (polls,
// approvals, …); promote to a shared resolver when the second module lands. Unknown → home.
const ROUTES: Record<string, (id: string) => string> = {
  // tenant-app is served under /tenant; the todo detail page is app/pages/tools/todo/[id].vue
  todo: (id) => `/tenant/tools/todo/${id}`,
}

export function resolveUrnRoute(urn: string): string {
  const parsed = parseUrn(urn)
  if (!parsed) return '/'
  const build = ROUTES[parsed.module]
  return build ? build(parsed.id) : '/'
}
