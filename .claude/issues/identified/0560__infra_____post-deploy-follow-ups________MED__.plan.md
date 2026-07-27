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

### 3. Rebuild dev + verify the seed combine (the session's original task) — DONE 2026-07-26
- [x] `pnpm env-rebuild` ran clean (USER-RUN): all one-shots exited 0 (db-migrate incl. the 89
      default-privilege statements, zitadel-seed, n8n-import), 24 containers healthy.
- [x] Assistant verified read-only: anchor identities (`site-admin@`/`anchor-admin@`/
      `anchor-user@example.com` — home/active; site-admin `idp_user_id` pre-linked, anchor
      users adopt-by-email at first login), 2 Large Tenants (7+8 residents) + full CLI/ORG/WS
      tree, site-admin claims = 10 perms incl. `p:app-admin-super` + 6 modules, all 13 n8n
      workflows imported + active (error-handler active), `n8n.workflow_run` 0 errors.
      Browser login as `site-admin@example.com` confirmed by user (curl can't carry the
      Secure-flagged dev cookies over plain http — scripted-ceremony 404/exchange-failed log
      lines from this verification are artifacts, ignore).
- [x] NOTE: dev super-admin login changed `bucket@function-bucket.net` → `site-admin@example.com`
      (memory `project_super_admin_lacks_app_user` already updated).

### 4. Resend (prod notification email — blocks invite-user / forgot-password delivery)
- [x] `function-bucket.com` VERIFIED in Resend (2026-07-26): user placed MX/SPF (`send.`),
      DKIM (`resend._domainkey`), DMARC in DO's DNS panel; assistant triggered the Resend
      verify via API (status had been `not_started` — the records alone don't start it).
- [x] send-notification DELIVERS on prod (2026-07-26, Resend `last_event: delivered`).
      **Two defects found + fixed en route:**
      1. DO blocks outbound SMTP 25/465/587 at the account level (verified from the box) —
         `NOTIFY_SMTP_PORT` 465 → **2465** (Resend's implicit-TLS fallback port; `.env.prod.tpl`).
      2. A redeploy that re-runs `n8n-import` against a live n8n leaves stale in-memory webhook
         routes (import/publish write straight to the DB) → webhook 404 → `triggerWorkflow`
         masked GraphQL error. Fix: `deploy.sh` now runs `compose restart n8n` after `up -d`.
      Also noted: the `firstEvent.getTime` stats-rollup stack traces in n8n logs are 2.30.7
      noise (dev shows the identical error; harmless).

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
