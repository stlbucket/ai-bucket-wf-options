# Plan: Live scan-badge flip via pg-notify push (asset-storage v2 — final-eval M3)

> **Execution Directive:** Spec first, then implement — this is a non-trivial feature.
> Invoke: `/fnb-stack-spec .claude/issues/identified/asset-scan-pg-notify-badge.plan.md` to author
> the spec (update `.claude/specs/asset-storage/` + `sockets-pattern.md` references), then
> `/fnb-stack-implementor` against the resulting spec.
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify
> read-only.

**Severity: LOW (v2 enhancement)** · Workstream: asset-storage · Identified: 2026-07-06 (final-eval M3; recorded in `asset-scan-workflow.data.md` Responsibilities #7)

## Details

v1 behavior (per spec, working): after upload the UI shows "Scanning…" and the user must
refresh/poll to see the badge flip to Clean/Infected/Scan error. The recorded v2 refinement is a
push: when the `asset-scan` workflow resolves, notify the browser so `AssetList` flips the badge
live.

The `asset-scan-completed.ts` handler (now in
`apps/worker-app/server/lib/worker-task-handlers/`) is the designated emission point — it already
logs `assetId` + `verdict` and carries a `// Later: pg-notify → socket push` marker.

## Design constraints (decide in the spec)

- **Emitter:** `NOTIFY` from SQL is the house pattern. Options: (a) `pg_notify` inside
  `storage_fn.resolve_asset_scan` (fires exactly when the terminal verdict commits — recommended;
  survives handler crashes after resolve), or (b) JS `pg_notify` from `asset-scan-completed`
  (fires only when the on-completed uow runs). Channel naming must follow the d4 convention —
  msg uses `topic:<id>:message`; propose `asset:<tenant_id>:scan` (payload: assetId, verdict).
- **Bridge + socket host:** msg-layer's `pg-notify-bridge` + WS route is the only precedent
  (dedicated `pg.Client` not a pool → d5; hand-rolled `channelPeers` map → d6; auth in the
  `upgrade` hook → d1; the h3 websocket-resolve fix baked into the bridge plugin must be
  replicated, not removed). storage-layer currently has **no** WS server and does not enable
  `nitro.experimental.websocket`. Options: (a) add a WS carve-out to storage-layer mirroring
  msg-layer (new `server/` infra — heavier, but self-contained), or (b) a PostGraphile GraphQL
  **subscription** through the existing graphql-api-app WS/SSE endpoints (`serv.makeWsHandler`
  already runs) — likely far less new infrastructure; investigate PostGraphile 5 subscription
  support via the `postgraphile-5-expert` skill before choosing.
- **Client:** `AssetList`/`useSiteAssets` today poll nothing — the page refreshes manually. The
  composable should expose the live update without breaking R1/R2 (components stay props-only;
  the subscription belongs in the composable layer, with `Msg.vue` as the only sanctioned
  component-owned-socket exception — do not copy it).
- **Tenant scoping:** notifications must not leak across tenants — scope the channel by tenant
  and/or verify claims on subscribe (RLS does not protect NOTIFY payloads).

## Suggested sequence

1. Spec: pick emitter + transport (recommend SQL `pg_notify` in `resolve_asset_scan` + GraphQL
   subscription if PostGraphile 5 supports LISTEN-backed subscriptions cleanly; else WS carve-out).
2. DB: one sqitch change (rework `resolve_asset_scan` to `pg_notify`) with revert/verify.
3. Transport + composable + `AssetList` wiring.
4. Verify: two browsers, upload in one, badge flips in both without refresh; verdicts still land
   when no subscriber is connected (NOTIFY is fire-and-forget — the DB row stays authoritative).

## Verification

Upload → badge flips live within ~1 s of the verdict; EICAR flips to Infected; no cross-tenant
delivery (second tenant's session sees nothing); `pnpm build` green.
