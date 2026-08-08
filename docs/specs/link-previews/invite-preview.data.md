# Link Previews — Invite Ceremony Preview (Data)

Static, branded unfurl previews for the invite/onboarding ceremony links (the single-use URLs the
`SendInviteModal` / `InviteUserModal` hand out). Registry + og pattern: `_shared.data.md`. Index +
decisions: `README.md`.

## Status
**Implemented** 2026-08-07 — static `useSeoMeta` on `set-password.vue` ("You've been invited to
Function Bucket") + `verify-email.vue` ("Verify your email for Function Bucket"). No token read, no
consumption. Verified via `curl`. The per-invite org-name follow-on remains deferred (L6).

## Why static (L6)
The invite link is a single-use ZITADEL ceremony URL — `/auth/set-password?userId=…&code=…` (and
the `/auth/verify-email` variant). The page **consumes the `code` only on POST** (the form submit);
a GET — including a messaging-app bot's prefetch — just renders the form. So a **static og card
built from constants** is zero-risk: no token read, nothing to burn, nothing to reveal. It carries
**no per-invite data** in v1 (no email, no org, no code) — a generic "You've been invited" already
beats "function bucket".

## The change

`apps/auth-app/app/pages/set-password.vue` and `apps/auth-app/app/pages/verify-email.vue` each get a
static `useSeoMeta` at setup top-level (renders into the SSR `<head>` — these pages are already
reachable unauthenticated):

```ts
// set-password.vue
useSeoMeta({
  title: 'Set up your Function Bucket account',
  ogTitle: "You've been invited to Function Bucket",
  description: 'Set your password to finish creating your account.',   // [FILL IN] final copy
  ogDescription: 'Set your password to finish creating your account.',
  ogImage: OG_IMAGE,           // L7 — same brand asset as the OTP preview
  ogType: 'website',
  twitterCard: 'summary',
})
```

```ts
// verify-email.vue
useSeoMeta({
  title: 'Verify your email — Function Bucket',
  ogTitle: 'Verify your email for Function Bucket',
  description: 'Confirm your email address to continue.',              // [FILL IN] final copy
  ogDescription: 'Confirm your email address to continue.',
  ogImage: OG_IMAGE,
  ogType: 'website',
  twitterCard: 'summary',
})
```

- **No `useAsyncData`, no fetch, no query read** — constants only. The `?userId&code` query is
  untouched and unconsumed by the preview.
- The existing form logic (`state`, POST-on-submit, `410 expired` handling) is unchanged.

## Follow-on — per-invite org/inviter name (deferred, L6)
To preview "You've been invited to **Acme** by **Kevin**", the invite-user n8n workflow (R22) that
mints the ceremony URL would append a **non-sensitive** label param (e.g. `&org=Acme`), and the
page would reflect it into `ogTitle` — accepting that the org name then lives in unfurl caches /
forwarded messages. Weigh at the time; v1 stays generic. Coordinate with
`docs/specs/user-invitation/invite-user.workflow.md` if pursued.

## What does NOT change
- The invite-user workflow, the ceremony endpoints, token validation/consumption — untouched.
- `SendInviteModal.vue` / `InviteUserModal.vue` — untouched (they copy/send the URL as-is; the
  preview is a property of the landing page, not the modal).
