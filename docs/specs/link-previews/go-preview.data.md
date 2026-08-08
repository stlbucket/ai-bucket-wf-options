# Link Previews — OTP Deep-link Preview (Data)

The change to the OTP landing page `/auth/go/[id]` so its unfurl preview shows `Poll: …` /
`Todo: …` instead of "function bucket". Registry + og pattern: `_shared.data.md`. The page's
interactive behavior is specified by `docs/specs/otp-login/go.ui.md` / `go.data.md` and is
**unchanged** — this spec only adds SSR-rendered `<head>` metadata.

## Status
**Implemented** 2026-08-07. SSR fetch base resolved to `import.meta.server ? '' : authAppUrl`; the
`onMounted` fetch moved to `useAsyncData`; `useSeoMeta` renders the preview server-side. Verified via
`curl` (no JS): `Todo: Buy milk` / `Poll: Favorite color?` / dead-link `Item`.

## The one structural change: fetch on the server, not `onMounted` (L4)

`apps/auth-app/app/pages/go/[id].vue` today fetches the public projection in `onMounted`:

```ts
onMounted(async () => {
  const { deepLink: dl } = await $fetch(`${authAppUrl}/api/otp/link`, { query: { id: linkId.value } })
  deepLink.value = dl
  // … dead-link / logged-in-switch / choose state …
})
```

That fetch runs **only in the browser**, so a crawler (no JS) never gets the label. Move the
projection fetch to `useAsyncData` so it runs during SSR and its result is available for `<head>`:

```ts
const { data: deepLink } = await useAsyncData(`deep-link:${linkId.value}`, () =>
  $fetch<DeepLinkPublic>(`/auth/api/otp/link`, { query: { id: linkId.value } })
    .then((r) => r.deepLink)
    .catch(() => null), // dead-link → null; page falls to State A, preview falls to the generic card
)
```

- `[FILL IN]` — confirm the SSR-safe fetch base for the `otp/link` route during server render
  (relative `/auth/api/otp/link` should resolve in-app; if not, use `authAppUrl`). The endpoint is
  the existing pre-claims Nitro route (`otp/link.get.ts`) — no server change.
- The existing reactive `deepLink` ref becomes the `useAsyncData` `data` (a `Ref`), so the
  dead-link / logged-in-switch / `choose` logic that reads `deepLink.value` keeps working. The
  **client-side** state resolution (`isLoggedIn`, `assumeResidency`, redirects) stays exactly as it
  is — only the *source* of `deepLink` moves from `onMounted` to `useAsyncData`. Move the
  state-deciding logic out of `onMounted` into either the `useAsyncData` continuation (SSR-safe
  parts) or an `onMounted`/`watch` that reads the now-preloaded `deepLink` (client-only parts like
  the logged-in redirect).

## The preview tags (L2/L4/L5/L7)

Immediately after the fetch (runs on server so it lands in the SSR `<head>`):

```ts
import { buildPreview } from '#shared/utils/urn-route'

const preview = computed(() =>
  buildPreview({ module: deepLink.value?.module, subjectLabel: deepLink.value?.subjectLabel }),
)

useSeoMeta({
  title: () => preview.value.title,          // "Poll: Favorite color?" / "Todo: Buy milk"
  ogTitle: () => preview.value.title,
  description: () => preview.value.description,
  ogDescription: () => preview.value.description,
  ogImage: OG_IMAGE,                         // L7 — [FILL IN] brand asset
  ogType: 'website',
  twitterCard: 'summary',
  twitterTitle: () => preview.value.title,
  twitterDescription: () => preview.value.description,
})
```

- **Dead / expired / revoked / unknown link:** `deepLink` is null (or `expired`/`revoked`), so
  `buildPreview` falls to the `FALLBACK` noun → title `"Item"` with the generic brand description.
  Acceptable and non-leaky (§5 `_shared.data.md`). Optionally special-case to a fixed
  "This Function Bucket link has expired" title — `[FILL IN]` keep generic vs. expired-specific.
- The label is already rendered in State B ("You've been sent a Todo — Buy milk"), so no new
  disclosure; the tenant name is not included (L5).

## What does NOT change
- `app_fn.get_deep_link` / the `otp/link` endpoint / the public projection shape — untouched
  (already returns `{ subjectLabel, module, expired, revoked }`).
- `auth.deep_link.subject_label` — stays the bare name; no `create_deep_link` change.
- The share-side callers (`todo/[id].vue`, `poll/[id].vue`, `ShareModal.vue`) — untouched; they
  already pass the bare label (`tree.name`, `p.title`) into `shareToLink`.
- Every interactive state (A/B/C/D), the OTP flow, the logged-in switch — behavior unchanged.

## Follow-on modules
`approval`, `@mention`, `quick-react` need **no page change** — they land on the same
`/auth/go/[id]`; adding their row to the `MODULES` registry (`_shared.data.md` §1) gives them both
their in-app route and their unfurl preview.
