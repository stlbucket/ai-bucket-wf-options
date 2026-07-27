# Plan: Post-first-deploy follow-ups (do-prod is live — protect it, then finish the edges)

> **Execution Directive:** Work this plan via `/fnb-stack-implementor <this-file>`. Most items
> are **user-run** (git, GH secrets, cloud/DNS, env rebuild) — the assistant assists + verifies
> read-only. Full first-deploy history (15 defects + fixes, all verified live 2026-07-26):
> `0010__infra_____deployment-do-aws-terraform_____MED__.plan.md` progress log.

**Severity: MED** · Workstream: deployment/infra · Planned: 2026-07-26

## Context

do-prod (`function-bucket.com`, droplet `129.212.153.36`, images @ `0a8fc0940713`) is live and
fully shaken down: TLS on apex/id./n8n., OIDC login end-to-end, /auth/profile, ZITADEL console,
n8n owner + editor, scheduled workflows green (sync-breweries, error-handler, asset-scan-reaper),
`do-env-build` re-runs are clean no-ops. **Everything deployed comes from the uncommitted working
tree** — that is the standing risk this plan starts with.

## Task list (ordered)

### 1. Commit the working tree — USER-RUN, do first
- [x] Committed to `lets-deploy` + pushed (2026-07-26; not yet merged to main).
- [x] Tag provenance restored: CI `build-images.yml` built + pushed all 8 images under
      `f1e26197…` (2026-07-26), and `deploy.yml` recreated the prod stack on those tags.

### 2. CI image pipeline — USER wires secrets; assistant verifies workflow runs — DONE 2026-07-26
- [x] 22 GH Actions repo-level secrets added (gh CLI; `SITE_ADMIN_*`/`SITE_TENANT_NAME`/
      `N8N_ADMIN_PASSWORD` stay laptop-side — bootstrap-identities is operator-run, not CI).
- [x] `build-images.yml` green (11m36s, amd64 runners) → `deploy.yml` green end-to-end
      (apply → render → ssh deploy → health-verify 200s on apex/id./n8n.).
      **Four CI-vs-laptop defects found + fixed en route:**
      1. `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` was gitignored — CI
         checkout can't build (codegen needs live PostGraphile). Now committed; only the
         schema.json dumps stay ignored.
      2. `infra/env/.env.prod.tpl` matched the `.env.*` gitignore — never committed. Negated.
      3. `deploy.yml` step-env clobbered `MANAGED_PG_ADMIN_{DB,PASSWORD}`/`APP_PG_PASSWORD`
         to `''` on do-prod (aws-conditional with empty fallback beats GITHUB_ENV). Fixed with
         `env.` fallbacks. Also: sensitive tf outputs now `::add-mask::`ed (the PG admin
         password printed clear in run 30232842244's predecessor logs — user to delete logs
         of run 30232128096 + optionally rotate the cluster password).
      4. `deploy.sh` passed `$SSH_OPTS` bare to rsync (parsed as rsync's own `-i`/`-o` flags;
         inner ssh keyless). Fixed with `-e "ssh $SSH_OPTS"` on all three rsyncs.
      **Plus:** CI ssh access = temporary firewall window (new tf output `firewall_id`;
      deploy.yml opens port 22 to the runner IP pre-deploy, `always()`-closes it after).

### 3. Rebuild dev + verify the seed combine (the session's original task)
- [ ] `pnpm env-rebuild` (USER-RUN) — verifies: combined `db/seed.sql` (anchor
      `site-admin@example.com` + `anchor-admin@`/`anchor-user@example.com` + 2 Large Tenants),
      matching ZITADEL roster (dev password unchanged), and the dev-side fixes that rode along
      (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, zitadel-seed "unchanged policy = no-op" hardening,
      the 89 rewritten default-privilege statements deploy clean on the dev container too).
- [ ] Assistant verifies read-only after: login as `site-admin@example.com`, anchor residents,
      large-tenant tree, reaper/workflows green in dev n8n.
- [ ] NOTE: dev super-admin login changed `bucket@function-bucket.net` → `site-admin@example.com`
      (memory `project_super_admin_lacks_app_user` already updated).

### 4. Resend (prod notification email — blocks invite-user / forgot-password delivery)
- [ ] USER: verify `function-bucket.com` in Resend; DKIM/SPF records go into **DO's DNS panel**
      (DO hosts the zone now; manual records survive `terraform apply`, die with teardown).
- [ ] Verify: send-notification workflow delivers (profile → notification prefs, or an invite).

### 5. Usage-driven prod smoke (plan 0010 Phase 7 tail)
- [ ] Upload an asset → quarantine scan → promote (asset-scan + ClamAV + Spaces).
- [ ] Play a battleship/checkers game (game-event referee + anthropic credential).

### 6. Tracked hardening / cosmetics (do opportunistically)
- [x] Managed-PG TLS `verify-full` with the mounted DO CA — **spun out to plan
      `0570__security__managed-pg-verify-full-tls`** (2026-07-26): full touchpoint inventory
      (terraform CA output → deploy.sh ship → compose mounts → 10+ connection flips) authored;
      the flip itself needs a user-run deploy window, so it doesn't ride this tree blind.
- [ ] App-role downgrade off `doadmin` — existing plan `0040__security__superuser-database-url`.
- [x] Spaces inline `cors_rule` → `digitalocean_spaces_bucket_cors_configuration` (done
      2026-07-26; module validates against provider 2.96.0 — next `terraform apply` shows the
      bucket update + one new resource, same CORS values).
- [x] UC-rule added as **UC14** in `ui-components-rules.md` (2026-07-26; UC13 stays reserved for
      form validation): pages rendering urql-backed components must set `ssr: false` — propagated
      to global-rules' UC reference + both orchestrator skills (R21).
- [ ] Known-cosmetic: teardown always 403s deleting the region-default VPC (fires last, ignore);
      `docker.n8n.io` rate-limits manifest pulls (image build FROM uses the Docker Hub mirror).

### 7. Later / optional
- [ ] AWS environment (`aws-prod`) — fully authored, never provisioned; apply plan-0010 lessons
      (amd64 is native on EC2; RDS lacks a `postgres` DB? — verify the ZITADEL
      `ADMIN_EXISTINGDATABASE` equivalent for RDS, whose default DB name differs).

## Out of scope
- New feature work; agent-app removal; staging envs (see plan 0010 "Out of scope / linked").
