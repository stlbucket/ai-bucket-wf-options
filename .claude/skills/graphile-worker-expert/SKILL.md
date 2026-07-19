---
name: graphile-worker-expert
description: LEGACY (retired from the fnb stack 2026-07-17 — R22; the workflow engine is now apps/agent-app via the claude-agent-sdk skill). Graphile Worker reference kept only for reading old history/branches or for non-fnb projects. Do not engage for new fnb work — background jobs, workflows, cron, and "Postgres job queue" questions route to the claude-agent-sdk skill and .claude/specs/agentic-workflow-engine/.
---

# Graphile Worker Expert

> **LEGACY for fnb:** graphile-worker was removed from this stack on 2026-07-17 (agentic
> workflow engine, `global-rules.md` R22). For any current fnb workflow/job need, use the
> `claude-agent-sdk` skill. The content below is a general Graphile Worker reference only.

Graphile Worker is a job queue that stores jobs in PostgreSQL and executes them on Node.js. It uses `LISTEN`/`NOTIFY` for low latency (typically <3ms schedule-to-execution) and `SKIP LOCKED` for fast, contention-free job fetching. It guarantees at-least-once execution with automatic exponential-backoff retries, and it pairs especially well with Postgres-centric stacks (PostGraphile, PostgREST) where jobs are created from inside the database via triggers or functions.

## When to reach for this skill

Use it for anything involving `graphile-worker`: installing and running the worker, writing task executors, enqueueing jobs (from JS or SQL), config presets, cron/recurring tasks, `job_key` patterns (debounce/throttle/dedupe), batch jobs, forbidden flags, error handling, the `jobs` view, admin functions, and scaling. The reference files below contain the precise API signatures and SQL — read them rather than reconstructing details from memory, because the function names, option names, and caveats are specific and have changed across versions.

## Core mental model

A **job** is a single unit of work stored in the database (created via `addJob()` in JS or `graphile_worker.add_job()` in SQL). A **task** is a *type* of work ("send_email"); its **task identifier** is the unique name; a **task executor** is the async JS function that runs it. The worker installs and manages its own schema (default `graphile_worker`) and creates/updates it automatically on startup.

A task executor is an `async (payload, helpers) => { ... }` function. **If it returns, the job succeeded and is deleted. If it throws/rejects, the job failed and is retried with exponential backoff.** The single most common bug is not awaiting all async work — every promise the executor starts must be awaited, with no "untethered" promises, or the worker may treat the job as done prematurely.

Two ways to run: **CLI mode** (recommended default — reads tasks from a `tasks/` directory and a `crontab` file) and **library mode** (`run()`/`runOnce()` in your own Node process, more control). Two ways to enqueue: **from JS** (`WorkerUtils.addJob`, or the runner's `addJob`) and **from SQL** (`graphile_worker.add_job(...)`, ideal for triggers).

## Requirements

PostgreSQL 12+ and Node 18+ (use worker 0.13.x or earlier for older versions). Keep `queue_name` / `task_identifier` to printable ASCII ≤128 chars, `job_key` ≤512 chars, `schema` ≤32 chars. As of v0.13.0 worker no longer uses `pgcrypto`.

## Quick start (CLI mode)

```bash
npm install --save graphile-worker
```

Create `tasks/hello.js` (filename = task identifier):

```js
module.exports = async (payload, helpers) => {
  const { name } = payload;
  helpers.logger.info(`Hello, ${name}`);
};
```

Run it (from the folder containing `tasks/`); the schema is auto-installed:

```bash
npx graphile-worker -c "postgres:///my_db"
```

Enqueue from SQL:

```sql
SELECT graphile_worker.add_job('hello', json_build_object('name', 'Bobby Tables'));
```

## Quick start (library mode)

```js
const { run } = require("graphile-worker");

const runner = await run({
  connectionString: "postgres:///my_db",
  concurrency: 5,
  noHandleSignals: false, // install graceful-shutdown signal handlers
  pollInterval: 1000,
  taskList: {
    hello: async (payload, helpers) => {
      helpers.logger.info(`Hello, ${payload.name}`);
    },
  },
  // or: taskDirectory: `${__dirname}/tasks`  (exactly one of taskList/taskDirectory)
});
await runner.promise; // always await (or otherwise handle) to avoid unhandled-rejection crashes
```

To enqueue efficiently from your app, build one `WorkerUtils` singleton and reuse it (see references/library-api.md). Do **not** use `addJobAdhoc` (formerly `quickAddJob`) in hot paths — it opens and tears down a connection pool per call.

## Decision guide — which reference to read

Read the relevant reference file(s) before writing code; each has the exact signatures and the gotchas.

- **Configuration / presets / `graphile.config.{js,ts}` / all `worker.*` options / env vars** → `references/configuration.md`
- **Writing task executors / the `helpers` object / loading TS or executable tasks / batch-job handling / TypeScript payload typing** → `references/tasks-and-helpers.md`
- **Enqueueing from JS (`addJob`, `addJobs`, `WorkerUtils`, `TaskSpec`) and running the worker as a library (`run`/`runOnce`/`runMigrations`/`Runner`)** → `references/library-api.md`
- **Enqueueing from SQL (`add_job`/`add_jobs`), triggers, stored procedures, `SECURITY DEFINER`, the CLI flags reference, connection strings** → `references/sql-and-cli.md`
- **`job_key` (debounce / throttle / dedupe), `job_key_mode`, array-payload merging, removing jobs, and all the caveats** → `references/job-key.md`
- **Recurring tasks: crontab file format, `opts`, time phrases, backfill, distributed crontab, library-mode cron items** → `references/cron.md`
- **Operations: error handling, exponential-backoff schedule, the `jobs` view, admin functions (complete/fail/reschedule/force-unlock/cleanup), forbidden flags, scaling & performance, schema/tracking tables, uninstall, WorkerEvents** → `references/operations.md`

## High-value rules that prevent real bugs

These come up constantly and are easy to get wrong; keep them front of mind regardless of which reference you're in.

1. **Await everything in a task executor.** No fire-and-forget promises. Prefer splitting large jobs into smaller ones (parallelism + safer retries), especially for non-idempotent work like sending emails.
2. **Design tasks so jobs never perma-fail.** After repeated failure, log it and *exit successfully* so the job is deleted. Perma-failed jobs accumulate in the table and degrade performance. The whole queue is fast *because the jobs table stays small* (completed jobs are auto-deleted).
3. **Avoid high-cardinality queue names.** Don't use UUIDs / random strings / timestamps as `queueName` — each creates a dead queue. Needing to run `GC_JOB_QUEUES` regularly is a sign you're misusing queue names. A named queue runs its jobs *serially* (concurrency 1); omit it for parallel execution.
4. **Don't touch the private tables.** `_private_jobs`, `_private_job_queues`, etc. are unstable and may change in a patch release; reading them (even the `jobs` view) inside a transaction can cause jobs to be skipped and execute out of order. Use the documented `add_job`, admin functions, and the `jobs` view (the latter sparingly, never in a transaction, selecting only needed columns with indexed filters).
5. **`add_job` needs database-owner privileges.** To call it from a lower-privileged role (e.g. via PostGraphile), wrap it in a `SECURITY DEFINER` function that performs its own access checks.
6. **`job_key` only exists while a job is pending/failed.** Completed jobs are deleted, so `remove_job` on a completed key is a no-op. Incorporate the task identifier into the key to avoid clobbering unrelated jobs, and handle the rare `null` return under high contention.
7. **Crontab is UTC-only** and the syntax isn't 100% standard cron. Always set an explicit, immutable `id=` when you have multiple schedules for one task; changing the derived identifier can cause duplicate executions.
8. **Graceful shutdown matters.** SIGTERM/SIGINT stop new jobs, drain in-flight ones, then exit. A hard kill (SIGKILL/segfault/power loss) leaves jobs locked for ~4 hours before automatic recovery; only use `force_unlock_workers` for workers you *know* are dead.

## Versioning note

Some APIs were renamed across versions (e.g. `quickAddJob` → `addJobAdhoc` in v0.17; `add_jobs`/`addJobs` are experimental and may change in a minor release; `force_unlock_workers`, the `jobs` view, and migration-driven shutdown arrived in v0.16). When the user's version matters or behavior seems off, check it and consult the official docs at https://worker.graphile.org/docs and release notes at https://github.com/graphile/worker/blob/main/RELEASE_NOTES.md.
