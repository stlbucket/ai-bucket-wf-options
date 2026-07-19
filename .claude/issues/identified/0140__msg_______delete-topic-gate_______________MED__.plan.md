# Plan: `msg_api.delete_topic` has no permission gate and no DELETE policy — ungated and non-functional

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/msg-delete-topic-gate.plan.md`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

`db/fnb-msg/deploy/00000000010410_msg_fn.sql:344` — `msg_api.delete_topic` is the only `msg_api`
function **without** a `perform jwt.enforce_permission('p:discussions')` gate. Its four siblings all
have it: `upsert_topic` (line 72), `upsert_message` (155), `upsert_subscriber` (248),
`deactivate_subscriber` (316). This violates global-rules R8 and the verified pattern the specs cite
as the canonical example.

Simultaneously, `db/fnb-msg/deploy/00000000010420_msg_policies.sql` defines only SELECT + INSERT
policies on the msg tables — **no DELETE policies** — so if `delete_topic` executes as SECURITY
INVOKER (`authenticated`), RLS denies the delete anyway. Two possibilities depending on the
function's delegation: if the actual delete happens in a SECURITY DEFINER `msg_fn` function, RLS is
bypassed and the delete succeeds **ungated**; if the delete runs in the `_api` INVOKER context, the
mutation is a silent dead-end exposed in the GraphQL schema (PostGraphile exposes all of `msg_api`).

## Implication

Either an ungated destructive mutation (any authenticated user can delete any topic they can name —
worst case), or dead API surface that fails confusingly at runtime (best case). Both are wrong;
which one it is must be pinned down as step 1.

## Suggested fix

1. Read the full `msg_api.delete_topic` + its `msg_fn` delegate to determine which failure mode
   applies (definer-bypass vs policy-dead).
2. Decide the product intent with the user: is topic deletion a feature?
   - **If yes:** add the `jwt.enforce_permission('p:discussions')` gate (plus an ownership check —
     only the topic creator or an admin should delete; `jwt.resident_id()` vs topic owner), and add
     the corresponding DELETE policy or keep the delete inside a SECURITY DEFINER `_fn` with an
     explicit ownership guard. Cascade semantics for messages/subscribers must be decided
     (soft-delete via status vs hard delete).
   - **If no:** drop the function. PostGraphile will stop exposing the mutation; re-run codegen
     (`pnpm graphql-api-generate` → `pnpm -F @function-bucket/fnb-graphql-client-api generate`)
     to confirm no client code references it (grep for `deleteTopic` in
     `packages/graphql-client-api/src/` — none exists today).
3. One sqitch corrective change in `db/fnb-msg` either way.

## Verification

- If kept: as a non-owner authenticated user, `deleteTopic` GraphQL mutation → permission error;
  as owner → topic gone, messages handled per decided cascade.
- If dropped: mutation absent from regenerated `src/generated/fnb-graphql-api.ts`; `pnpm build` green.
