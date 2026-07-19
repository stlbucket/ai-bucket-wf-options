# Plan: graphql-client-api consistency — msg mapper missing, generated-type leak, return-shape drift, missing vitest config

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/graphql-client-api-consistency.plan.md`
> Gate is `pnpm build`. Codegen (if fragments change) needs PostGraphile up at localhost:4000.
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS4 · Identified: 2026-07-05

## Details

`packages/graphql-client-api/src` deviates from its own mapper/return-shape conventions (global-rules
R3/R4, `package-layers-pattern.md`):

1. **Generated-type leak through the public barrel.**
   `src/composables/useMsgTopics.ts:8` imports `TopicStatus` from `../generated/fnb-graphql-api` and
   exposes it in the exported `SubscribedTopicSummary.status: TopicStatus` (line 13). Because the
   composable is barrel-exported, a generated type reaches the UI — exactly what R3's "barrel does
   not export the generated module" is meant to prevent. The correct type is an `fnb-types` enum.
2. **Composables bypass the mapper convention (inline shaping + unsafe casts).** No mapper exists for
   the msg domain. `useMsgTopic.ts:5-20,29-55`, `useMsgTopics.ts:10-27,33-64`, `useTodoMsg.ts:13-22`,
   `useProfileClaims.ts:26-57`, `useResidency.ts:51-59` hand-shape data inline. `useResidency.ts:57-58`
   uses `as unknown as ResidentStatus`/`ResidentType`; `useProfileClaims.ts:31,39,51,52` use blanket
   casts. Every other entity goes through `src/mappers/<entity>.ts`.
3. **Return-shape inconsistency.** `useTodoMsg.ts:40` returns `{ topic, hasTopic, fetching,
   startDiscussion }` — **drops `error`** (every other query composable returns it). Refetch handle
   naming splits: `useWfDetail`/`useWfInstances`/`useWfTemplates` expose `refresh`, most others
   expose `executeQuery`; `useMsgTopic.ts:114` exposes neither.
4. **Deprecated `TopicSummary` alias** (lines 20-21) still exported (see `dead-code-sweep.plan.md`).
5. **Missing `vitest.config.ts`.** `graphql-client-api` declares `"test": "vitest run"` but has no
   `vitest.config.ts` (every other lib package has one). Per the testing convention in the
   implementor skill, `turbo run test` would fail here (no config, no `passWithNoTests`).
6. **`console.log('rezzies', ...)`** at `useMsgTopics.ts:94` (also in `dead-code-sweep.plan.md`).

## Implication

The generated-type leak undermines the whole fnb-types boundary (the UI can now name a generated
type). Inline shaping + `as unknown as` casts defeat the type safety mappers exist to provide (a
schema change won't surface as a type error at the mapper). Inconsistent return shapes make
composables non-interchangeable and surprise page authors (missing `error` = unhandled failures).
Missing vitest config breaks the test task for this package.

## Suggested fix

1. **Add a msg-domain mapper** `src/mappers/msg.ts` (`toMsgTopic`/`toMsgMessage`) returning
   `fnb-types` shapes; add the msg entity/enum types to `@function-bucket/fnb-types` (topic status as
   an UPPERCASE string-literal union mirroring the GraphQL enum). Route `useMsgTopic`/`useMsgTopics`/
   `useTodoMsg` through it. Remove the `TopicStatus` import + the `@deprecated TopicSummary` alias.
2. **Convert `useProfileClaims`/`useResidency` inline shaping to mappers** (`toProfileClaims`,
   `toProfileResidency`) — drop the `as unknown as` casts by selecting the right fields and mapping
   enums properly. Expand the `.graphql` fragments if fields are missing (R3), re-run codegen.
3. **Normalize return shapes:** every query composable returns `{ data|<lists>, fetching, error }`;
   pick one refetch idiom (the specs say `executeQuery({ requestPolicy: 'network-only' })`, no
   `refresh` — align the wf composables to that). Add the missing `error` to `useTodoMsg`.
4. **Add `vitest.config.ts`** to graphql-client-api (the tests-present shape from the implementor
   skill's testing section, or `passWithNoTests` until `test-foundation.plan.md` adds real tests).
5. Coordinate the barrel/return-shape wording with `skill-fnb-stack-implementor-enrich.plan.md` and
   `specs-fnb-types-drift.plan.md`.

## Verification

- `grep -rn "from '../generated" packages/graphql-client-api/src/composables/` → only value-hook
  imports, no type leaks re-exported through the barrel.
- No `as unknown as` in composables; `grep -rn "as unknown as" packages/graphql-client-api/src` → empty (or justified + commented).
- Every query composable returns `error`; one refetch idiom.
- `pnpm -F @function-bucket/fnb-graphql-client-api build` green; app boots (barrel intact after removing `TopicSummary`).
- `pnpm -F @function-bucket/fnb-graphql-client-api test` runs (config present).
