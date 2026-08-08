import { parseUrn } from '@function-bucket/fnb-types'

// One entry per URN module: where it renders in-app + how its shared deep link previews when a
// messaging app (iMessage / Slack / …) unfurls it. The single per-module presentation source for
// the OTP deep-link flow (spec docs/specs/link-previews/ + otp-login/ D7). Lives in shared/utils
// so both sides auto-import it: the server OTP verify redirect (server/api/otp/verify.post.ts) and
// the /auth/go landing page (app/pages/go/[id].vue — route for the logged-in switch, preview for
// the <head> og tags). Add a row as modules register (approval, @mention, quick-react → free).
interface ModulePresentation {
  route: (id: string) => string
  previewNoun: string // link-previews L2 — "Poll", "Todo", "Approval" (og title is "<noun>: <label>")
  icon: string // i-lucide-* (UC11)
  ogDescription: string // link-previews L5 — generic call-to-action; NEVER the tenant/workspace name
}

// tenant-app is served under /tenant; detail pages are app/pages/tools/<module>/[id].vue
const MODULES: Record<string, ModulePresentation> = {
  todo: {
    route: (id) => `/tenant/tools/todo/${id}`,
    previewNoun: 'Todo',
    icon: 'i-lucide-square-check',
    ogDescription: 'Log in with a one-time code to view this todo.'
  },
  poll: {
    route: (id) => `/tenant/tools/poll/${id}`,
    previewNoun: 'Poll',
    icon: 'i-lucide-vote', // verified in use: apps/tenant-app/app/pages/tools/poll/index.vue
    ogDescription: 'Log in with a one-time code to respond to this poll.'
  }
}

// Unknown module → home route + a neutral, non-leaky preview.
const FALLBACK: ModulePresentation = {
  route: () => '/',
  previewNoun: 'Item',
  icon: 'i-lucide-link',
  ogDescription: 'Log in with a one-time code to view this item.'
}

// Unchanged public API (same signature + behavior) — consumed by server/api/otp/verify.post.ts and
// the landing page's logged-in switch path. Derived from the same map, so it stays in lockstep.
export function resolveUrnRoute(urn: string): string {
  const parsed = parseUrn(urn)
  if (!parsed) return '/'
  return (MODULES[parsed.module] ?? FALLBACK).route(parsed.id)
}

// Presentation for a bare module key (the landing page reads `module` from the public projection).
export function modulePresentation(module: string | null | undefined): ModulePresentation {
  return (module && MODULES[module]) || FALLBACK
}

export interface LinkPreview {
  title: string // "Poll: Favorite color?" — or the noun alone ("Poll") when there is no label
  description: string // the module's generic, tenant-free call-to-action
}

// Pure formatter for a link's unfurl preview (link-previews L2 + L5). `subjectLabel` is the BARE
// item name (e.g. "Buy milk") cached on auth.deep_link; the noun prefix lives here, never in the
// cached label. No tenant/workspace name ever enters the preview.
export function buildPreview(input: {
  module: string | null | undefined
  subjectLabel: string | null | undefined
}): LinkPreview {
  const p = modulePresentation(input.module)
  const label = input.subjectLabel?.trim()
  return {
    title: label ? `${p.previewNoun}: ${label}` : p.previewNoun,
    description: p.ogDescription
  }
}
