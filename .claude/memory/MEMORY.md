# Memory Index

- [n8n images are Docker Hardened (no apk)](project_n8n_hardened_image.md) — n8n 2.30.x = hardened Alpine, apk removed; custom images need a multi-stage ldd-copy, not `apk add`; clamdscan pkg is `clamav-clamdscan`
- [Cross-schema CREATE OR REPLACE in sqitch reverts](feedback_sqitch_cross_schema_replace.md) — DROP is correct for foreign-schema OR REPLACE functions; user confirmed this is expected
- [Explicit imports required in layer packages](feedback_explicit_imports_in_layers.md) — all imports must be explicit in packages/ layers; no auto-imports, no ambient types
- [Nuxt UI v4 API — all components](feedback_nuxt_ui_v4_table_api.md) — always check v4 docs before using any U* component; UTable: `accessorKey`/`header`, `#*-cell`, `row.original.*`, `:data`, `v-model:sorting`
- [fnb-msg full stack status](project_msg_stack.md) — architecture, cross-app fetch pattern, WebSocket setup, DB types status, pending verification steps
- [h3 WebSocket publish broken](feedback_h3_websocket_publish.md) — h3 1.15.11 has no publish method; use direct peer.send() via Map registry
- [Spec system](project_spec_system.md) — `.claude/specs/` with global-rules.md (R1–R21), graphql-api-pattern.md, sockets-pattern.md + per-page `.ui.md`/`.data.md` pairs; skill: `/fnb-stack-spec`
- [JWT schema](project_jwt_schema.md) — JWT accessor functions live in `jwt` schema (not `auth`); grants for authenticated/anon in auth_policies.sql
- [db-types generation — RETIRED](project_db_types_generation.md) — db-types (Kysely/Kanel) is gone; replaced by db-access + graphql-client-api. Only the barrel-export ESM-crash lesson still applies
- [Architecture is single-sourced](feedback_architecture_single_source.md) — stack described once in pattern files; any architecture change updates specs + both skills in the same change (global-rules R21). Default = urql GraphQL → PostGraphile; 2-arg withClaims is a carve-out
- [Sqitch: edit deploy files in place](feedback_sqitch_edit_in_place.md) — current phase: no new sqitch deploy files; add SQL to the existing file where it belongs (mind deploy order for grants/revokes)
- [n8n Code-node + workflow-iteration gotchas](project_n8n_code_node_gotchas.md) — $env blocked (use process.env), no URL global, localhost→::1 (use n8n:5678), secrets via credential; reload = import+publish+restart. n8n_worker grants on app_fn live in fnb-n8n (fnb-app deploys first)
- [Super-admin lacks p:app-user](project_super_admin_lacks_app_user.md) — anchor super-admin login has p:app-admin but NOT p:app-user; gate shared/tenant-user actions with any-of {p:app-user, p:app-admin} (DB enforce_any_permission or registry array), not plain p:app-user
- [Generated GraphQL enums are nominal](project_generated_enums_are_nominal.md) — codegen emits nominal TS enums; fnb-types union enum values need `as unknown as Gql<Enum>` to flow into generated mutation variables (mappers already do this for reads); a regen can surface this as a fresh TS2322 build break
