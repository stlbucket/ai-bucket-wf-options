# Handoff: function-bucket logo & favicon

## Overview
Brand mark for **function-bucket** (repo `stlbucket/ai-bucket`): a terminal-style wordmark — `> fn·bucket_` — plus an "fn" square icon. Selected direction: **2b "The Prompt"** from the explorations in `AI-Bucket Logo.dc.html`.

## About the Design Files
The bundled `.dc.html` file is a **design reference created in HTML** — not production code. The PNG/SVG files in `assets/` ARE production-ready assets. The task is to wire these assets into the target apps (Nuxt 4 apps in the monorepo) and into Zitadel branding.

## Fidelity
**High-fidelity.** Colors are taken verbatim from `packages/auth-layer/app/assets/css/main.css` (Cascadia theme tokens). Typography is JetBrains Mono 700 (already the repo's `--font-mono`).

## The Mark
- **Wordmark:** `> fn·bucket_` set in JetBrains Mono Bold. The `>` prompt glyph is forest green; `fn·bucket` is ink (white on dark, blue-900 on light); the trailing `_` cursor is cascadia blue.
- **Icon:** rounded square (radius 10/48 ≈ 21%), blue-900 background, "fn" in JetBrains Mono Bold, green-300.
- Middle dot is U+00B7 (·).

## Design Tokens
| Token | OKLCH | Hex |
|---|---|---|
| green-600 (prompt glyph, light bg) | oklch(0.48 0.11 155) | #156f41 |
| green-400 (prompt glyph, dark bg) | oklch(0.62 0.1 155) | #50986b |
| green-300 (icon "fn" text) | oklch(0.78 0.08 155) | #8ec7a1 |
| blue-600 (cursor, light bg) | oklch(0.42 0.11 248) | #055085 |
| blue-400 (cursor, dark bg) | oklch(0.6 0.09 248) | #5385b4 |
| blue-900 (icon bg; wordmark ink on light) | oklch(0.3 0.1 248) | #002f5d |
| ink dark-mode | oklch(0.95 0.005 250) | #eceff2 |
| paper light / dark | oklch(0.99 0.003 250) / oklch(0.23 0.01 250) | #fafcfe / #191d22 |

Font: JetBrains Mono 700. No other fonts in the mark.

## Assets
All in `assets/` (PNGs captured at 4x from the reference design):
- `logo-dark.png` — wordmark for dark backgrounds, transparent, 1228×384
- `logo-light.png` — wordmark for light backgrounds, on paper-white, 1228×384
- `icon-512.png` / `icon-light-512.png` — dark/light icon masters
- `apple-touch-icon-180.png`, `favicon-48.png`, `favicon-32.png`, `favicon-16.png`
- `favicon.svg` — vector icon. ⚠ its "fn" text renders with JetBrains Mono only where that font is available; prefer the PNGs anywhere you can't guarantee the font. If you want a fully portable SVG, convert the text to paths (e.g. with a font tool) in the dev environment.

## Nuxt wiring
In each app's `nuxt.config.ts`:
```ts
app: { head: { link: [
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon-180.png' },
] } }
```
Place the PNGs in `public/` (consider a shared layer so both apps inherit them).

## Zitadel branding
Zitadel's branding uploader **rejects SVG and caps files at 0.5MB** — use the PNGs (all are well under the cap).
- **Logo** (shown on the login card): `logo-light.png` for the light theme, `logo-dark.png` for the dark theme.
- **Icon** (console top-left / compact contexts): `icon-light-512.png` (light), `icon-512.png` (dark).
- Colors (hex required): primary `#156f41`, background light `#f0f4f7` / dark `#0e1216`, font light `#1b2025` / dark `#eceff2`.
- Configure at instance level: `/ui/console/instance?id=branding` (or per-org), upload per theme, then **activate** the preview.
- Self-bootstrapped instances can set these in `DefaultInstance.LabelPolicy` (LogoURL/IconURL/…Dark, colors) in zitadel config.
- Optionally upload JetBrains Mono TTF as the custom font to match the wordmark.

## Files
- `AI-Bucket Logo.dc.html` — all explorations; chosen option is section id `2b`; exact-size masters in the "export strip".
- `assets/*` — production assets listed above.
