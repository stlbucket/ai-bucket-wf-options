# Link Previews — Shared Data (registry, SSR-og pattern, formatting, security)

Types, the presentation registry, the og-meta pattern, and the formatting/security rules shared by
`go-preview.data.md` and `invite-preview.data.md`. Index + decisions: `README.md`.

## Status
**Implemented** 2026-08-07 — `apps/auth-app/shared/utils/urn-route.ts` carries the `MODULES`
registry, `modulePresentation`, and `buildPreview` as specified below; the SSR-og pattern (§3) is
live on `go/[id].vue` + the invite pages. og:image = `${origin}/logo-light.png`.

## 1. The per-module presentation registry (L3)

Today `apps/auth-app/shared/utils/urn-route.ts` maps `module → route`. Extend it to the **single**
per-module presentation source — route **and** preview from one map. It lives in `shared/utils/` so
both the server (OTP verify redirect) and the page (`/auth/go/[id]`) auto-import the same resolver
(the otp-login precedent).

```ts
import { parseUrn } from '@function-bucket/fnb-types'

// One entry per URN module: where it renders in-app + how it previews when its deep link is
// unfurled by a messaging app. `previewNoun` is the L2 noun ("Poll: <title>"); `ogDescription`
// is the generic, tenant-free call-to-action (L5). Add a row as each module ships.
interface ModulePresentation {
  route: (id: string) => string
  previewNoun: string        // L2 — "Poll", "Todo", "Approval"
  icon: string               // i-lucide-* (already used by the landing State B header; UC11)
  ogDescription: string      // L5 — NO tenant/workspace name
}

const MODULES: Record<string, ModulePresentation> = {
  todo: {
    route: (id) => `/tenant/tools/todo/${id}`,
    previewNoun: 'Todo',
    icon: 'i-lucide-square-check',
    ogDescription: 'Log in with a one-time code to view this todo.',
  },
  poll: {
    route: (id) => `/tenant/tools/poll/${id}`,
    previewNoun: 'Poll',
    icon: 'i-lucide-bar-chart-3', // [FILL IN] verify i-lucide name (UC11)
    ogDescription: 'Log in with a one-time code to respond to this poll.',
  },
  // approval, @mention, quick-react … added as those modules ship (README follow-ons)
}

const FALLBACK: ModulePresentation = {
  route: () => '/',
  previewNoun: 'Item',
  icon: 'i-lucide-link',
  ogDescription: 'Log in with a one-time code to view this item.',
}

// Unchanged public API — derived from the same map (no behavior change for existing callers).
export function resolveUrnRoute(urn: string): string {
  const parsed = parseUrn(urn)
  if (!parsed) return '/'
  return (MODULES[parsed.module] ?? FALLBACK).route(parsed.id)
}

// New: presentation for a module key (the landing page reads `module` from the public projection,
// so callers pass the bare module string, not a URN).
export function modulePresentation(module: string | null | undefined): ModulePresentation {
  return (module && MODULES[module]) || FALLBACK
}
```

- **`resolveUrnRoute` keeps its exact signature and behavior** — it is consumed by
  `server/api/otp/verify.post.ts` and the landing page's logged-in switch path; those are untouched.
- The `subject_label` cached on `auth.deep_link` stays the **bare** name (`Buy milk`,
  `Favorite color?`). No DB or `create_deep_link` change — this feature is presentation-only.

## 2. `buildPreview` — the formatting helper (L2 + L5)

A pure helper next to the registry (same file). Composes the og title/description from a module +
the bare label.

```ts
export interface LinkPreview {
  title: string        // L2 — "Poll: Favorite color?" | "Poll" when no label
  description: string  // L5 — module's generic, tenant-free CTA
}

export function buildPreview(input: {
  module: string | null | undefined
  subjectLabel: string | null | undefined
}): LinkPreview {
  const p = modulePresentation(input.module)
  const label = input.subjectLabel?.trim()
  return {
    title: label ? `${p.previewNoun}: ${label}` : p.previewNoun, // L2
    description: p.ogDescription,                                 // L5 — no tenant name
  }
}
```

- **L2 (noun + title everywhere):** `${previewNoun}: ${label}`; title-less link → the noun alone.
- **L5 (no tenant name):** the description comes only from the module registry — never from the URN's
  tenant (which the public projection hides anyway). The label is sharer-chosen and already shown on
  the landing page, so it discloses nothing new; the tenant name would.

## 3. The SSR-og pattern (L4)

Unfurl crawlers issue a plain GET and **run no JavaScript** — every preview tag must be present in
the **server-rendered HTML**. The rule for any page in scope:

1. Fetch whatever the preview needs **during SSR** — `useAsyncData(...)` (runs on the server), never
   `onMounted` (client-only). Static previews (invites) need no fetch at all.
2. Set the tags with **`useSeoMeta`** (Nuxt auto-imported — confirmed available in every app's
   `imports.d.ts`) so they render into the initial `<head>`:

```ts
useSeoMeta({
  title: preview.title,
  ogTitle: preview.title,
  description: preview.description,
  ogDescription: preview.description,
  ogImage: OG_IMAGE,          // L7 — one branded asset for all links; [FILL IN] path
  ogType: 'website',
  twitterCard: 'summary',
  twitterTitle: preview.title,
  twitterDescription: preview.description,
})
```

- **Verify** at build time by `curl`-ing the SSR HTML and grepping `og:title` — not by looking in
  devtools (which shows the post-hydration DOM and would pass even if SSR omitted the tag).
- `auth-app/app.vue` currently sets no `title`; these per-page `useSeoMeta` calls are the first
  meaningful titles on the auth surface. No global default is added (each in-scope page owns its own).

## 4. `og:image` (L7)
A single branded default (logo/wordmark) for **every** link — no per-item images. `OG_IMAGE` is an
absolute URL to a static asset. `[FILL IN]` the asset path against `docs/specs/brand-identity/`
(and confirm it's reachable unauthenticated — the OTP + invite landings already are).

## 5. Security / enumeration notes
- **No new disclosure on OTP links.** The public projection `app_fn.get_deep_link` already returns
  exactly `{ subjectLabel, module, expired, revoked }` and is enumeration-safe; the label is already
  rendered on the landing page. Putting it in og tags exposes nothing the page didn't already show.
- **Tenant name stays hidden (L5).** The description is registry-sourced; the tenant id/name never
  enters the preview.
- **Dead/expired/unknown OTP link → a generic branded preview** (brand title + neutral description),
  never a 500 and never anything beyond "this link is no longer valid" (matches the landing's
  fail-closed State A).
- **Invite links consume nothing on GET (L6).** The ceremony page reads its `code` only on POST;
  the preview is static constants with no token read, so an unfurl bot's prefetch can neither burn
  nor reveal the code. The preview carries no per-invite data in v1.
