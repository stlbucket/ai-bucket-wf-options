# Plan: Align useWfTemplates with the toWf mapper (#2)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/fnb-types-wf-templates-mapper.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself.

## Status: ALREADY APPLIED

This one-line consistency fix was applied during the rollout cleanup. Recorded here for completeness
and so the trio of loose ends is documented.

## Context

`useWfInstances` returns `Wf[]` (via `toWf`), but its sibling `useWfTemplates` returned raw wf rows —
an inconsistency, given `workflow/index.vue` annotates both lists as `Wf`.

## Change (done)

`packages/graphql-client-api/src/composables/useWfTemplates.ts`:
```ts
import { toWf } from '../mappers/workflow'
// ...
const wfTemplates = computed(() =>
  (data.value?.wfTemplates ?? [])
    .filter((w): w is NonNullable<typeof w> => w != null)
    .map(toWf),
)
```

## Verification
- `pnpm -F @function-bucket/fnb-graphql-client-api build` then `pnpm build` — zero TS errors.
- `useWfTemplates` returns `Wf[]` (fnb-types), matching `useWfInstances`.
- Runtime (after Docker rebuild): the workflow **Templates** list renders unchanged.
