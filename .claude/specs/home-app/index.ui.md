# home-app/index — Landing Page UI

## Status
Implemented

## Route
`/` → `apps/home-app/app/pages/index.vue`

## Required Permission
None — public page. Auth state determines which view renders.

## Layout

Two mutually exclusive views based on `useAuth().isLoggedIn`:

---

### Logged-Out: Hero View (`v-if="!isLoggedIn"`)

Full-viewport-height centered column:

- `<FunctionBucketMark size="lg" />` — SVG logo at large size
- Heading: `function-bucket` (monospace, bold)
- Subheading: `your tools. in a bucket.` (muted)
- `<UButton>` linking to `${authAppUrl}/login` (external href, `size="xl"`, label: `sign in`)

---

### Logged-In: Dashboard View (`v-else`)

Constrained to `max-w-5xl mx-auto`:

**Header row:**
- `<FunctionBucketMark size="sm" />` — logo at small size
- Greeting: `hey, {displayName | 'there'}.` (monospace, bold)
- Subheading: `here's what's in your bucket` (muted, small)

**Module grid:**
- `v-if="availableSections.length > 0"` → responsive CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- One `<ModuleNavSection>` card per section (keyed by `section.key`)
- `v-else` → `<UEmpty icon="i-lucide-package-open" label="nothing in the bucket yet" description="ask your admin for access to some tools" />`

## Component: `FunctionBucketMark.vue`
Props: `size?: 'sm' | 'md' | 'lg'` (default: `'md'`)
SVG logo using `var(--ui-primary)` for color — no hardcoded colors.

## User Interactions
| Action | Trigger |
|---|---|
| Sign in | Click "sign in" button → navigates to auth-app login |
| Open module | Click `ModuleNavSection` card → navigates to module route |
