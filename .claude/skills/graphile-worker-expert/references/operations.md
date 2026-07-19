# Operations: errors, retries, jobs view, admin, flags, scaling, events

## Error handling

- **Task failure:** a thrown error fails the job and schedules a retry with exponential backoff. With async/await, errors cascade automatically if you write tasks well (await everything).
- **Termination signal** (`SIGTERM`/`SIGINT`/etc.): triggers **graceful shutdown** — stop accepting new jobs, wait for in-flight jobs, then exit. Restart workers this way. Within ~5 seconds further signals are ignored; after that, another signal forces a hard shutdown: running jobs are "failed" (retried elsewhere after backoff) and the worker exits.
- **Instantaneous exit** (`process.exit()`, segfault, `SIGKILL`, power loss): the worker's in-flight jobs stay **locked for at least 4 hours**. Every ~8–10 minutes a worker sweeps for jobs locked >4h and releases them. With many workers, release tends to happen near the 4-hour mark. You can release earlier by clearing `locked_at`/`locked_by` — or use `force_unlock_workers` (below) for workers you know are dead.
- **Harmless startup error:** before the schema exists you may see `relation "graphile_worker.migrations" does not exist` once — worker then creates the schema.
- **Database migration:** running a newer worker with new migrations issues a `NOTIFY`; worker 0.16+ `LISTEN`s for it and shuts down if received (so old workers don't run against a newer schema).
- **Error codes:** `GWBKM` — invalid `job_key_mode` (expected `replace`, `preserve_run_at`, or `unsafe_dedupe`).

## Exponential backoff

Delay between attempts uses `exp(least(10, attempt))` seconds (the job must fail before the next attempt is scheduled). After ~4 hours, attempts settle to ~every 6 hours until `max_attempts` is reached. Approximate cumulative schedule: attempt 1 ≈ 2.7s, attempt 5 ≈ total ~3m53s, attempt 10 ≈ total ~9h40m, then ~6h07m per additional attempt; the default 25 attempts span roughly ~3 days. To inspect precisely:

```sql
select attempt,
  exp(least(10, attempt)) * interval '1 second' as delay,
  sum(exp(least(10, attempt)) * interval '1 second') over (order by attempt asc) total_delay
from generate_series(1, 24) as attempt;
```

## The `jobs` view (stable read interface; v0.16+)

The underlying tables are private/unstable. Use `graphile_worker.jobs` to inspect enqueued jobs. New columns may be added over time; deletions/type changes require a semver-major release.

> **Performance:** do **not** read frequently; any read from worker tables can degrade running workers, especially scanning many rows or without an index. Select only needed columns, apply indexed filters, and **never read the view inside a transaction** (can cause performance issues and skipped jobs).

Columns: `id`, `queue_name`, `task_identifier`, `priority` (lower/negative = earlier), `run_at`, `attempts`, `max_attempts`, `last_error`, `created_at`, `updated_at`, `key` (the job_key), `locked_at`, `locked_by` (WorkerPool id), `revision` (bumped each update), `flags`.

> The job **`payload` is intentionally excluded** to discourage expensive filtering. If you need the payload, use a tracking/shadow table (see Schema below); for debugging only you can read private tables carefully (don't script against them — they can change in a patch release).

## Administrative functions

For admin UIs / external control. Available in SQL and via a `WorkerUtils` instance (`makeWorkerUtils`). Unless noted, these **ignore locked jobs** (including all running jobs). Don't run manual `UPDATE`/`DELETE` against locked jobs.

### Complete jobs (deletes them)
```sql
SELECT * FROM graphile_worker.complete_jobs(ARRAY[7, 99, 38674]);
```
```ts
const deletedJobs = await workerUtils.completeJobs([7, 99, 38674]);
```
Marks unlocked jobs as completed (which deletes them); may include failed/permafailed jobs. Returns the deleted jobs (possibly fewer than requested).

### Permanently fail jobs
```sql
SELECT * FROM graphile_worker.permanently_fail_jobs(ARRAY[7, 99], 'Enter reason here');
```
```ts
const updatedJobs = await workerUtils.permanentlyFailJobs([7, 99], 'Enter reason here');
```
Sets unlocked jobs' `attempts = max_attempts`. Returns updated jobs.

### Reschedule jobs
```sql
SELECT * FROM graphile_worker.reschedule_jobs(
  ARRAY[7, 99, 38674],
  run_at := NOW() + interval '5 minutes',
  priority := 5, attempts := 5, max_attempts := 25
);
```
```ts
const updatedJobs = await workerUtils.rescheduleJobs([7, 99, 38674], {
  runAt: '2020-02-02T02:02:02Z', priority: 5, attempts: 5, maxAttempts: 25,
});
```
All options optional; omitted/null left unchanged. Can postpone/advance, or re-arm a failed/permafailed job. Ignores locked jobs.

### Force unlock workers (v0.16+)
Only for workers that have **crashed/died**. Unlocks all jobs locked by the given (dead) worker IDs.
```sql
SELECT graphile_worker.force_unlock_workers(ARRAY['worker-0d069f0d6be41d1adb','worker-cd357d05e3382cd169']);
```
```ts
await workerUtils.forceUnlockWorkers(["worker-0d069f0d6be41d1adb","worker-cd357d05e3382cd169"]);
```
> **Danger:** never pass IDs of *live* workers. The only legitimate use is when a worker has truly ceased to exist (e.g. detected via heartbeat or the supervising process noticing the exit).

### Database cleanup
Over time, tables accumulate stale queue names, task identifiers, and permafailed jobs. Clean with the cleanup function (CLI `--cleanup` or `workerUtils.cleanup`). Needing this often signals misuse (permafails, random queue names, etc.).

- **`GC_JOB_QUEUES`** — delete job queues with no jobs. Safe.
- **`GC_TASK_IDENTIFIERS`** — delete task identifiers with no jobs. **Unsafe while any worker is running** (running workers cache internal identifiers; deleting one then re-queuing generates a new identifier that won't match the cache).
- **`DELETE_PERMAFAILED_JOBS`** — delete unlocked jobs that will never retry (`attempts = max_attempts`). Deletes data but otherwise safe.

```bash
graphile-worker --cleanup DELETE_PERMAFAILED_JOBS,GC_TASK_IDENTIFIERS,GC_JOB_QUEUES
```
```ts
await workerUtils.cleanup({ tasks: ["DELETE_PERMAFAILED_JOBS", "GC_TASK_IDENTIFIERS", "GC_JOB_QUEUES"] });
```
> Write tasks so jobs never permafail (e.g. after N attempts, do cleanup and exit successfully).

## Forbidden flags (runtime filtering / rate limiting)

Set a job's `flags` (a list of strings) at creation/update. In library mode, pass `forbiddenFlags` so jobs bearing any listed flag are skipped at runtime.

```js
await run({ /* ... */ forbiddenFlags });
```

`forbiddenFlags` can be: `null`; a string array; a function returning null/array; or an async function returning a promise of null/array. If a function, worker calls it **every time it looks for a job** and skips jobs with any returned flag. Keep it **fast** — maintain a cache updated periodically (e.g. once a second) or use pub/sub rather than computing on the fly. For a full rate-limiting implementation, see the `graphile-worker-rate-limiter` project and issue #118.

## Concurrency & priority techniques

Out of the box: a **named queue** has concurrency 1 (serial); **no queue** means jobs run as fast as there are workers. To get concurrency *between* 1 and "unbounded":
- **Dedicated worker with set concurrency:** run one worker that handles *only* this task identifier at the desired concurrency (don't use a named queue). Variant: N workers × concurrency M = N·M total.
- **Multiple queue names:** create as many named queues as the concurrency you want and distribute jobs across them (round-robin/random). Trade-off: ordering is only preserved within each queue.
- **Forbidden flags:** as above.

Managing priority (urgent jobs while workers are busy with long tasks):
- **Dedicated high-priority worker** for the urgent task identifier.
- **More concurrency** (more workers or higher concurrency).
- **Limit concurrency of slow tasks** (techniques above) to keep reserve capacity for high-priority jobs.

Scale up on demand: use **WorkerEvents** to detect overload — e.g. when a starting job's `run_at` is significantly earlier than `now - pollInterval` (assuming synchronized clocks) — and add capacity.

## Scaling & performance

Postgres + Graphile Worker can exceed **10,000 jobs/sec** in benchmarks (~a billion/day). To keep that performance:

- **Keep the jobs table small.** Completed jobs are auto-deleted; the fastest table to scan is an empty one. v0.14.0 improved behavior with larger tables, but small is still best.
- **Jobs should not permafail.** Your task code should detect repeated failure, log it, and **exit successfully** so the job is deleted — don't store long-term failures in the jobs table. Clear up permafailed jobs periodically: diagnose, fix the executor, then reduce `attempts` to retry, or delete them. (A delete like `delete from graphile_worker._private_jobs where attempts = max_attempts and locked_at is null;` is possible but touches a **private table** that may change in a patch release — run it manually, by a human, after inspection; fix the root cause.)
- **Future-scheduled jobs** also grow the table and can hurt peak performance — be thoughtful; consider batching.
- **Use the latest release** for ongoing performance improvements (esp. baseline performance when the queue is full of future/permafailed jobs).
- **Vacuum:** the jobs table has very high churn; give it a `VACUUM` during quiet periods.
- **Don't jump to another queue prematurely.** Postgres takes you far; only consider alternatives around 5k+ jobs/sec. (The maintainer has plans for batch-exporting jobs to external queues — get in touch if relevant.)

### FAQ performance notes
- **LISTEN/NOTIFY is on by default.** pgBouncer may be problematic unless in "connection"/session mode (too many connections stuck in `LISTEN`, or events not received). There's currently no option to disable LISTEN/NOTIFY or use a separate connection for it.
- **Future/failed jobs use polling** (not LISTEN/NOTIFY — nothing emits an event when time "ticks over"). Default poll is 2s; 30–60s is fine if you have perf concerns. When workers are always at full capacity, a new job is requested as soon as the previous finishes, so poll frequency and LISTEN/NOTIFY become largely irrelevant.
- **Each concurrent worker requests a job as soon as its previous one finishes.** Each instance `LISTEN`s and, on an event, hands it to an idle worker; if none is idle, it drops the event (a worker will request the next job when it frees up).

## Logger

Worker uses `@graphile/logger`. Default logs to `console`; debug-level is hidden unless `GRAPHILE_LOGGER_DEBUG=1`. In tasks, **always log via `helpers.logger`** so you can reroute later. Four levels, each `(message: string, meta?: LogMeta)`: `error`, `warn`, `info`, `debug`.

Customize with a `logFactory`:

```js
const { Logger, run } = require("graphile-worker");
function logFactory(scope) {
  return (level, message, meta) => { console.log(level, message, scope, meta); };
}
const logger = new Logger(logFactory);
run({ logger, /* pgPool, taskList, ... */ });
```

`scope` may contain (all optional): `label` ('worker' or 'job'), `workerId`, `taskIdentifier`, `jobId`. The returned function receives `(level, message, meta?)` where level is `error`/`warning`/`info`/`debug`. Don't return anything from it (future compatibility). Don't subclass/extend `Logger`.

> `GRAPHILE_ENABLE_DANGEROUS_LOGS=1` (plus debug logging) unlocks extra logs that may include extremely sensitive data (e.g. full connection string with password). **Never use in production.**

## WorkerEvents

Subscribe via `runner.events`, or pass your own `EventEmitter` as `events` (to catch early startup events before `run()` resolves, or via the preset's `worker.events`).

```js
runner.events.on("job:success", ({ worker, job }) => {
  console.log(`Worker ${worker.workerId} completed job ${job.id}`);
});
```

Available events (payloads in parentheses):
- Pool: `pool:create` (`{workerPool}`), `pool:listen:connecting` (`{workerPool}`), `pool:listen:success` (`{workerPool, client}`), `pool:listen:error` (`{workerPool, error, client}`), `pool:release` (`{pool}`), `pool:gracefulShutdown` (`{pool, message}`), `pool:gracefulShutdown:error` (`{pool, error}`).
- Worker: `worker:create` (`{worker, tasks}`), `worker:release` (`{worker}`), `worker:stop` (`{worker, error?}`), `worker:getJob:start` (`{worker}`), `worker:getJob:error` (`{worker, error}`), `worker:getJob:empty` (`{worker}`), `worker:fatalError` (`{worker, error, jobError}`).
- Job: `job:start` (`{worker, job}`), `job:success` (`{worker, job}`), `job:error` (`{worker, job, error}`), `job:failed` (`{worker, job, error}`, permanent failure), `job:complete` (`{worker, job, error}`, after result written to DB).
- Runner: `gracefulShutdown` (`{signal}`), `stop` (`{}`).

## Schema, tracking tables, restricted users

Worker installs tables/functions/views into `graphile_worker` (configurable). **Only use public APIs** — `add_job`, admin functions, the `jobs` view. Don't use private tables (`_private_jobs`, `_private_job_queues`, `_private_known_crontabs`, `_private_tasks`, `migrations`) directly: they change across minor versions, reading them impacts queue performance, and reading them in a transaction can make jobs invisible to workers (skipped, out-of-order). Reading the `jobs` view from a **read replica** is generally safe, though locking info may be stale.

### Tracking completed jobs (shadow table)
Worker deletes successful jobs, so to retain history or attach data:
1. Wrap `graphile_worker.add_job(...)` in your own function.
2. Insert details into your own "shadow" table there.
3. Optionally FK from your shadow table to `graphile_worker._private_jobs` with `ON DELETE CASCADE` or `ON DELETE SET NULL` (has performance overhead; the private schema may change, but referencing just the PK is okay).
4. Optionally put the shadow row id into the payload so the task can update progress/status — useful for surfacing job progress to end users and tracking completions.

### Restricted Postgres user
Worker expects to run as the database **owner** (not superuser). To use a limited user, you may need to pre-create the schema yourself. Worker decides whether to create the schema by checking for the migrations table — so create both the schema and that table to let worker proceed (per issue #132):

```sql
create schema graphile_worker;
create table graphile_worker.migrations (
  id int primary key,
  ts timestamptz default now() not null,
  breaking bool default false not null
);
```

## Uninstall / reset

Remove worker and all its jobs:

```sql
DROP SCHEMA graphile_worker CASCADE;
```

(Adjust if using a custom schema.) **Scale to zero first** (no running workers). `CASCADE` may also drop database objects that depend on worker (per `pg_depend`) — including your trigger functions and FK constraints. Test on non-production first and compare schema-only dumps before/after.
