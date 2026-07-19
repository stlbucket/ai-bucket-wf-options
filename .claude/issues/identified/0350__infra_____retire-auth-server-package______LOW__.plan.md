# Plan: retire the unused `packages/auth-server` package

> **Execution Directive:** Implement this plan via the `fnb-stack-implementor` skill — invoke it
> on *this* plan file. Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself —
> ask the user, then verify read-only.

**Severity: LOW** · Workstream: WS4 (cleanup) · Identified: 2026-07-19 (recurring spec/code
reconciliation sweep)

## Details

`@function-bucket/fnb-auth-server` has **zero consumers**:

- Its historical consumer (worker-app's graphile-worker task handlers) was retired with the
  workflow-engine migration (R22).
- Its last remaining consumer — the auth-app ping scaffolding (`Ping.vue` + `pages/ping.vue`
  calling `ping()`) — was removed by the 2026-07-19 dead-code sweep, along with `src/ping.ts`
  itself.
- The stale `"@function-bucket/fnb-auth-server": "workspace:*"` declaration in
  `apps/auth-app/package.json` was removed in the same sweep. A repo-wide grep for
  `fnb-auth-server` / `useFnbPgClient` / `doQuery` (excluding the package itself) returns
  nothing.

What remains is the package shell: `src/index.ts`, `src/use-pg-client.ts` (`pool`, `doQuery`,
`useFnbPgClient` — a raw-pg client factory duplicating what `db-access` already owns as the
root of trust), `src/required-env.ts`, build config.

## Implication

A whole workspace package that builds on every `pnpm build`, appears in the nine-package roster
(CLAUDE.md, `package-layers-pattern.md`), and offers a second, unsanctioned raw-pg path outside
the `db-access` root of trust — pure maintenance surface with no runtime role.

## Suggested fix

1. Confirm with the user that no out-of-repo consumer exists.
2. Delete `packages/auth-server/`; remove it from `pnpm-workspace.yaml` globs if named,
   `turbo` scope, and any Docker `packages-watch` build/healthcheck references
   (check `docker-compose.yml` for an auth-server dist healthcheck path).
3. Update the package roster docs in the same change (R21): CLAUDE.md packages list,
   `package-layers-pattern.md` (its section already notes the retirement candidacy),
   `fnb-stack-implementor` monorepo layout block.
4. `pnpm install` + `pnpm build` green; user restarts Docker; read-only smoke.

## Verification

- `grep -rn "fnb-auth-server\|useFnbPgClient" apps packages scripts docker-compose.yml` → empty.
- `pnpm build` green; auth-app boots (login flow untouched — it uses `db-access`, not this).
