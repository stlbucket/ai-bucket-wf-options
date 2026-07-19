# Plan: Iconify-per-app rule contradicts reality (3/5 apps don't declare it) — verify then fix rule or apps

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill. **Verify at runtime FIRST.**
> Invoke: `/fnb-stack-implementor .claude/issues/identified/iconify-rule-verification.plan.md`
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: LOW-MEDIUM (UNVERIFIED)** · Workstream: WS1 (+ possible app fix) · Identified: 2026-07-05

## Details

Project memory (`project_iconify_collection_per_app`) and the implementor skill state: *"Each Nuxt
app must declare `@iconify-json/*` directly or `i-lucide-*` icons render blank in Docker."*

But only **2 of 5 apps** declare an iconify collection in `package.json`:
- auth-app — `@iconify-json/lucide` + `@iconify-json/simple-icons` (lines 22-23)
- graphql-api-app — `@iconify-json/lucide` (line 18)
- **home-app, tenant-app, msg-app — none.**

So either (a) the rule is obsolete (icons now resolve via the layer's declaration — `auth-layer`
declares `@iconify-json/lucide` + `@iconify-json/simple-icons` per `package-layers-pattern.md`, and
maybe pnpm hoisting or Nuxt UI's bundled resolution now covers apps), or (b) icons are silently
broken (blank) in home-app/tenant-app/msg-app under Docker. The static audit can't tell which — this
needs a runtime check.

## Implication

If (b): every `i-lucide-*` icon in the three most-used feature apps renders blank in Docker — a
visible, pervasive UI defect. If (a): the rule + memory + skill are stale and will cause future
devs to add unnecessary deps (or waste time debugging a non-issue). Either way the rule and reality
must be reconciled.

## Suggested fix

1. **Verify first** (user starts the Docker stack; I inspect read-only): load a tenant-app and
   msg-app page that renders lucide icons (e.g. nav, buttons) and confirm they display, not blank.
   Check the browser for the icon SVGs.
2. **If icons render fine without the direct dep (rule is stale):**
   - Update the rule in the implementor skill and `ui-components-rules.md` (UC11 area) to reflect
     how icons actually resolve now (via the auth-layer declaration / Nuxt UI bundling).
   - Update/delete the `project_iconify_collection_per_app` memory (it reflects a past truth — note
     it was superseded and when).
3. **If icons are blank (rule is right, apps are wrong):**
   - Add `@iconify-json/lucide` (and `@iconify-json/simple-icons` if used) to home-app, tenant-app,
     msg-app `package.json` dependencies; `pnpm install` at root; user restarts Docker.
   - Keep the rule; strengthen the skill's checklist to flag missing collections when scaffolding.
4. Either way, `fnb-create-app` scaffold guidance should match the resolved truth
   (`skill-fnb-create-app-filename.plan.md`).

## Verification

- Runtime: lucide icons render in tenant-app + msg-app + home-app under Docker (read-only inspection).
- The rule text (skill + UC11), the memory, and the app package.jsons all agree with observed behavior.
- `pnpm build` green if deps changed.
