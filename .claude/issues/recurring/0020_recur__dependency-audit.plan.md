# Recurring: dependency audit

> **Execution Directive:** This is a recurring playbook — run *this* plan periodically; it never
> "finishes" and is never prioritized or closed. A run may spawn new numbered `identified/` items.
> Implement fixes via the `fnb-stack-implementor` skill. Gate is `pnpm build`. Never run `git`;
> never rebuild Docker yourself — ask the user, then verify read-only.

**Category: infra · Recurring (no rank, no severity)**

## When to run

Periodically, and before/after a dependency bump — sweep every `package.json` for hygiene. This is
the recurring form of `0280__infra__dependency-pinning`.

## Scope / checklist

1. **No floating specifiers** — flag any `"latest"`, `"*"`, or unpinned range across all workspace
   `package.json` files; the repo pins consistently (`nuxt ^4.4.2`, `@nuxt/ui ^4.6.1`, `vite ^8.x`).
2. **No stale/unused workspace deps** — grep each package's `src/` for actual imports of every
   `"@function-bucket/*": "workspace:*"` dep; remove dead ones (layering concern: the client data
   package must not runtime-depend on the raw-pg `db-access` root of trust).
3. **Direct-dependency rules honored** — layers/apps that use `@nuxt/ui` types declare
   `"@nuxt/ui": "^4.6.1"` directly (pnpm does not hoist transitive packages); each Nuxt app declares
   its own `@iconify-json/*` collection.
4. **Lockfile consistency** — `pnpm install` resolves cleanly with no unexpected version drift.

## Output

For each finding, fix directly (then `pnpm build`) or create a numbered
`identified/[####]__infra__[title-slug]__[SEV]__.plan.md` item (R23).
