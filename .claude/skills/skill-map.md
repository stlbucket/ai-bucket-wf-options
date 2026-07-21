# fnb Skill Map

The routing table for the fnb skill system. The two **orchestrator** skills (`fnb-stack-spec`,
`fnb-stack-implementor`) consult this map and engage specialists as needed; specialists never
call back up. This file is the **single registration point** — adding a new skill means adding
one row here (plus a pointer in an orchestrator checklist step only if the step's procedure
changes).

**How to engage a specialist:** read its `SKILL.md` (`.claude/skills/<name>/SKILL.md`) — and any
`references/*.md` file its decision guide names for your topic — *before* doing that step. Do
not paraphrase a specialist from memory; the whole point is that the file is fresher than you.

## Dependency direction (strict)

```
Tier 0  drivers         fnb-acquire-dataset (external datasets: recon → implicitly invokes spec → implementor)
Tier 1  orchestrators   fnb-stack-spec (authors contracts) · fnb-stack-implementor (executes them)
Tier 2  specialists     project procedures + technology references (table below)
Tier 3  ground truth    .claude/specs/* and the code itself
```

Tier 0 is the one exception to "nothing calls up": `fnb-acquire-dataset` is a top-level,
user-invoked workflow that does its own recon (producing a `<dataset>-expert` specialist), then
**implicitly invokes `fnb-stack-spec`** to author the spec and hands the plan to
`fnb-stack-implementor`. It never bypasses them.

- Orchestrators hold the **sequence** (checklists, failure signatures); specialists hold the
  **how** (conventions, APIs, gotchas); specs hold the **truth**.
- Specialists point down to specs/code and sideways to sibling specialists. Upward, at most a
  one-line scope handoff ("for the layers above X → skill `fnb-stack-implementor`") — never
  restated orchestrator content.
- Specialists never restate the stack outside their slice; they point at the owning skill/spec.

## Specialists — project procedures

| Skill | Engage when… |
|---|---|
| `fnb-db-designer` | designing tables/enums/RLS/permissions, extending the license/permission model, or answering "how does the DB handle X?" — the `jwt.*` helpers, `<module>`/`_fn`/`_api` trio, deny-all pre-claims pattern |
| `sqitch-expert` | any sqitch mechanics: plan entries, dependencies (incl. cross-project `project:change`), deploy/revert/verify, tags, rework, numbering ranges |
| `new-db-package` | creating a brand-new `db/<package>` (scaffolds files + registers in `DEPLOY_PACKAGES`) |
| `true-up-sqitch-package` | a package has deploy files missing revert/verify counterparts or plan entries out of sync |
| `fnb-create-app` | scaffolding a brand-new `apps/<slug>-app` (package.json, nuxt.config, compose service, nginx location) |
| `function-bucket-legacy-ui-converter` | migrating UI from the legacy Nuxt 3 function-bucket project |

## Specialists — technology references

| Skill | Engage when… |
|---|---|
| `postgraphile-5-expert` | PostGraphile config/smart tags/behaviors/inflection/plugins, grafast context, grafserv path-prefix deployment, schema-design-for-GraphQL questions |
| `n8n-cli` (global skill) | the n8n engine's operator loop (R22 — the sole workflow engine; specs `.claude/specs/n8n-parallel-engine/` + `.claude/specs/agentic-decommission/`): workflow build/export-to-repo (`n8n/workflows/*.json`), credentials, executions — `N8N_URL=http://localhost:$N8N_HOST_PORT` + `N8N_API_KEY` from `.env`. Node schemas live in the container; the asset-scan build hit 4 n8n-2.x gotchas (memory `project_n8n_hardened_image`) |
| `graphile-worker-expert` | LEGACY — graphile-worker is retired from the stack (R22). Engage only when reading old history/branches; never for new work |
| `zitadel-expert` | the OIDC ceremony, ZITADEL org/project/app config, service accounts, token validation, Actions, self-hosting |
| `vue-flow-expert` | Vue Flow canvases (nodes/edges/composables) and elkjs auto-layout (generic — the wf UOW canvas that used it is retired; no vue-flow consumers remain in-repo) |
| `vue-use-expert` | reactive/browser/DOM utility needs a VueUse composable likely covers |
| `breweries-expert` | fetching/filtering/searching brewery data via the Open Brewery DB API (endpoints, filters, sort syntax, response schema) |
| `airports-expert` | fetching/parsing/importing OurAirports data — the seven bulk CSVs, real column lists, live enum vocab, nullability, CSV gotchas (no API) |
| `terraform-export` | authoring/operating the `infra/terraform/` deployment code (spec `.claude/specs/deployment/`): HCL blocks + meta-args, reusable modules + per-env tfvars, remote state & the `s3` backend (AWS **and** DigitalOcean Spaces), provider version constraints + lock file, and the `init→plan→apply` CLI incl. `output -json` → `render-env.mjs`. General Terraform reference — the spec owns *what* fnb provisions |

## Vendored external skills (outside the tiering)

Not fnb skills and **not** in the orchestrator→specialist dependency graph — a third-party bundle
pinned in `skills-lock.json` (`digitalocean-labs/do-app-platform-skills`), symlinked under
`.agents/skills/` and mirrored into `.claude/skills/`. Read them **directly** as DO-service
references when a deployment task touches the matching surface; never route to them as a spec
specialist. The fnb deployment spec (`.claude/specs/deployment/`) **rejected DO App Platform**
(Compose-on-a-droplet + Managed PG/Spaces), so most of this bundle is **off-path**.

| Skill | On-path? | Engage when… |
|---|---|---|
| `postgres` | ✅ | configuring DO **Managed Postgres** — users, permissions, multi-tenant schemas, connectivity (the deployment spec's Phase 3/4 managed-PG bootstrap) |
| `spaces` | ✅ | DO **Spaces** (S3-compatible) — bucket policy, CORS, lifecycle, CDN, per-app creds |
| `managed-db-services` | ➖ | non-Postgres managed data (MySQL/Mongo/Valkey/Kafka/OpenSearch) — reference only; fnb uses Managed PG |
| `app-platform-networking` | ➖ | VPC / domains / CORS / static-IP concepts — useful vocabulary even though routing is Caddy, not App Platform |
| `app-platform-designer`, `deployment`, `app-platform-migration`, `app-platform-sandbox`, `app-platform-troubleshooting`, `devcontainers`, `planner`, `ai-services` | ❌ | App-Platform-only — apply **only** if the rejected App-Platform path is ever revisited |

`sheep` also surfaces in the skill list but belongs to a **different project**
(`sheep-prototype/.claude/skills/`); it is intentionally **not** registered here.

## Tiebreaks

- **"Add feature X" spanning DB + API + UI** → `fnb-stack-implementor` owns the run; it engages
  `fnb-db-designer`/`sqitch-expert` for step 1, `postgraphile-5-expert` for step 2, etc.
- **Pure DB design question** ("how do we model X?", "what permission gates Y?") →
  `fnb-db-designer` directly.
- **"Spec then build"** → `fnb-stack-spec` first (per `feedback_spec_before_build`), which
  engages `fnb-db-designer` while drafting `_shared.data.md`; then `fnb-stack-implementor`.
- **New module needing a new db package AND a new app** → implementor run that engages
  `new-db-package` then `fnb-create-app` at the corresponding checklist steps.
- **"Import/acquire an external dataset"** → `fnb-acquire-dataset` owns the whole run (Tier 0);
  it implicitly drives `fnb-stack-spec` then `fnb-stack-implementor` — don't invoke those
  separately for a dataset acquisition.

## Change management

Per **global-rules R21**: an architecture change updates the pattern file, both orchestrators,
**and any specialist skill documenting the affected area** in the same change. When adding a
skill: one row in the table above, a menu entry in `.claude/skills/fnb/SKILL.md` (the
human-facing `/fnb` directory — this file routes, that file ranks and describes), narrow
frontmatter triggers (orchestrators stay broad, specialists stay narrow), and no stack
restatement outside its slice.
