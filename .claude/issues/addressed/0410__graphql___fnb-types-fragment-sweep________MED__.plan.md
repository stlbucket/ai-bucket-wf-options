# Plan: Fragment completeness sweep — every fragment selects every field (#3)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/fnb-types-fragment-completeness-sweep.plan.md`
> Gate is `pnpm build`. Codegen requires PostGraphile up at `localhost:4000`.
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

## Context

Standing rule (memory `feedback_fragments_all_fields`): a GraphQL fragment should select **every**
field of its type — never trim the shared type to fit a thin fragment. During the rollout fragments
were expanded only where a type needed a field. This sweep makes every one of the 21
`fragment/*.graphql` select its type's full scalar field set, so the fragment is the single complete
projection and mappers/types can never silently miss a column.

## Steps

1. **Audit each fragment.** For every `packages/graphql-client-api/src/graphql/**/fragment/*.graphql`,
   introspect its GraphQL type (`{ __type(name:"X"){ fields { name type { kind name ofType{name} } } } }`
   at `localhost:4000`, or read the generated `*Fragment` type). Add any missing **scalar** fields.
   Skip Relay `nodeId` and object/relation fields (those stay explicit sub-selections where used).

2. **Already complete** (expanded earlier this rollout — verify, likely no change): `License`,
   `LicenseType`, `LicensePack`, `LicensePackLicenseType`, `TenantSubscription`, `Resident`,
   `Location`, `Profile`, `SupportTicket`, `SupportTicketComment`, `LicenseTypePermission`,
   `UowDependency`, `Tenant`.

3. **Candidates to expand** (introspect first): `Application` (likely `licenseCount`), `Todo`,
   `uow`, `wf`, and the discussions fragments `Message` / `Subscriber` / `Topic`.
   Keep `ProfileClaim`'s deliberately-commented `applicationKey` out (not part of `ProfileClaims`).

4. **One codegen run:** `pnpm -F @function-bucket/fnb-graphql-client-api generate`.

5. **Reconcile types + mappers for newly-added fields:**
   - Entity fragments (`Todo`, `wf`, `uow`, `Application`) → add the new field(s) to the matching
     `packages/fnb-types/src/*.ts` interface **and** its mapper in `src/mappers/*.ts` (keep the type
     honest — a fnb-type field must be populated by the mapper from a selected fragment field).
   - Discussions fragments feed composable **view** types (`MsgMessage`/`MsgTopic`/
     `SubscribedTopicSummary` in `useMsgTopic.ts`/`useMsgTopics.ts`): expand the fragment, but the
     view types only map what they use — extra selected fields are harmless, no view-type change needed.

## Critical files
- Every `packages/graphql-client-api/src/graphql/**/fragment/*.graphql` (audit; expand the incomplete ones).
- `packages/graphql-client-api/src/generated/*` (regenerated — do not hand-edit).
- For expanded entity fragments: `packages/fnb-types/src/{todo,workflow,application,...}.ts` +
  `packages/graphql-client-api/src/mappers/{todo,workflow,application,...}.ts`.

## Verification
- Gate `pnpm build` (order `fnb-types` → `db-access` → `graphql-client-api` → apps) — zero TS errors.
- Grep each `fragment/*.graphql` against its introspected type: no missing scalar fields remain
  (except intentional omissions like `ProfileClaim.applicationKey`).
- Runtime (after the user rebuilds Docker): spot-check a page per touched module renders unchanged;
  no ESM barrel-miss crash.

## Notes
- Adding fields to a fragment is safe for existing consumers (extra fields are ignored) — the only
  required follow-through is keeping expanded **entity** fnb-types + mappers in sync (step 5).
- Never trim a fnb-type or reintroduce `Maybe<>` to match a thin fragment — expand the fragment instead.
