# Library API: running and queueing jobs from JS

`graphile-worker` can be embedded in your Node app for two purposes: **running** jobs and **queueing** jobs.

## Running jobs

### `run(options): Promise<Runner>`
Runs until stopped by a signal (`SIGINT`, etc.) or by calling `stop()` on the resolved `Runner`.

### `runOnce(options): Promise<void>`
Like the CLI `--once` flag: runs until no runnable jobs remain, then resolves.

### `runMigrations(options): Promise<void>`
Like the CLI `--schema-only`: installs/updates the worker schema, then resolves. Doesn't need a task list.

### `RunnerOptions`

- **`concurrency`** — equivalent of CLI `--jobs` (same default).
- **`noHandleSignals`** — if `true`, worker won't install signal handlers; you handle graceful shutdown yourself.
- **`pollInterval`** — equivalent of CLI `--poll-interval`.
- **`logger`** — custom `Logger` (see operations reference).
- **Database (one of):**
  - `connectionString` — Postgres connection string, or
  - `pgPool` — a `pg.Pool` instance.
- **Tasks (exactly one of, except for `runMigrations`):**
  - `taskDirectory` — path to a directory of task handlers, or
  - `taskList` — object mapping task names → handler functions.
- **`schema`** — change the default `graphile_worker` schema.
- **`forbiddenFlags`** — see operations reference (rate limiting).
- **`events`** — pass your own `EventEmitter` to customize options or catch early startup events.
- **`noPreparedStatements`** — set `true` to disable prepared statements (e.g. external pooler); small performance cost.

Database resolution order if not given explicitly: `pgPool` → `connectionString` → `DATABASE_URL` env var → standard PostgreSQL env vars (at least `PGDATABASE`; not all are supported).

### `Runner` object

Resolved by `run()`:
- **`stop(): Promise<void>`** — stop accepting new jobs; resolves once in-progress jobs finish.
- **`addJob: AddJobFunction`** — enqueue a job (see below).
- **`promise: Promise<void>`** — resolves/rejects when the runner completes. **Always await or handle it** to avoid unhandled-rejection process crashes.
- **`events: WorkerEvents`** — an `EventEmitter` exposing runner events.

```js
await runner.addJob("testTask", { thisIsThePayload: true });

runner.events.on("job:success", ({ worker, job }) => {
  console.log(`Worker ${worker.workerId} completed job ${job.id}`);
});
```

## Queueing jobs

> The worker auto-installs its schema when it runs, but **queueing does not**. Ensure the schema exists first: run `graphile-worker -c "..." --schema-only`, or call `await workerUtils.migrate()`.

### `makeWorkerUtils(options): Promise<WorkerUtils>`

The efficient way to add jobs from JS. **Build one `WorkerUtils` and share it as a singleton.**

```js
const { makeWorkerUtils } = require("graphile-worker");

async function main() {
  const workerUtils = await makeWorkerUtils({ connectionString: "postgres:///my_db" });
  try {
    await workerUtils.migrate();
    await workerUtils.addJob("calculate-life-meaning", { value: 42 });
  } finally {
    await workerUtils.release();
  }
}
```

### `WorkerUtilsOptions`

- Database (exactly one): `connectionString` **or** `pgPool` (a `pg.Pool`).
- `schema` — change the default schema.

> If you pass `pgPool`, **attach error handlers**, or DB connection issues may crash your worker process:
> ```ts
> import { Pool } from "pg";
> const pool = new Pool({ /* ... */ });
> function handleError() {}
> pool.on("error", handleError);
> pool.on("connect", (client) => void client.on("error", handleError));
> ```

### `WorkerUtils` methods

- **`addJob(name, payload, spec?)`** — enqueue a job (see `addJob` below).
- **`migrate()`** — update the worker DB schema; returns a promise.
- **`release()`** — release the instance. Usually unnecessary (singleton), but useful in tests/one-off scripts so Node exits cleanly.
- Plus admin methods (`completeJobs`, `permanentlyFailJobs`, `rescheduleJobs`, `forceUnlockWorkers`, `cleanup`) — see operations reference.

### `addJobAdhoc(options, ...addJobArgs): Promise<Job>`

> Renamed from `quickAddJob()` in v0.17 (was `quickAddJob` through v0.16.x).

Convenience that opens a pool, adds the job, and tears the pool down — **inefficient, for one-off scripts only**. First arg is `WorkerUtilsOptions`; the rest are `addJob` args. Prefer `makeWorkerUtils` in real applications.

```js
const { addJobAdhoc } = require("graphile-worker");
await addJobAdhoc(
  { connectionString: "postgres:///my_db" },
  "calculate-life-meaning",
  { value: 42 },
);
```

## `addJob` — the universal signature

The same `addJob` signature appears everywhere (runner, `WorkerUtils`, `helpers`). It defers to the SQL `add_job` function under the hood. Used to enqueue for immediate or delayed execution, and (with `jobKey`/`jobKeyMode`) to replace/update existing jobs.

```ts
export type AddJobFunction = (
  identifier: string,   // task name to execute
  payload: unknown,     // JSON object, or array of objects for "batch job" mode
  spec?: TaskSpec,      // optional handling details
) => Promise<Job>;

export interface TaskSpec {
  queueName?: string;   // run jobs in this queue serially (default: null = parallel)
  runAt?: Date;         // schedule for the future (default: now)
  priority?: number;    // lower runs first (default: 0)
  maxAttempts?: number; // min 1 (= no retry); default: 25
  jobKey?: string;      // unique key to update/remove/dedupe later (default: null)
  jobKeyMode?: "replace" | "preserve_run_at" | "unsafe_dedupe"; // default: 'replace'
  flags?: string[];     // for forbiddenFlags filtering at runtime (default: null)
}
```

```js
await addJob("send_email", { to: "[email protected]" });
await addJob("reminder", {}, { runAt: new Date(Date.now() + 2 * 86400_000) });
```

> Avoid high-cardinality `queueName` values (UUIDs/random/timestamps) — they create dead queues that degrade performance and force `GC_JOB_QUEUES` cleanup. See job-key.md for `jobKey`/`jobKeyMode` semantics and operations.md for `flags`/`forbiddenFlags`.

## `addJobs` — efficient bulk insert *(experimental; may change in a minor release)*

Adds many jobs at once. With `jobKey` it can also replace existing jobs.

```ts
export type AddJobsFunction = (
  jobSpecs: AddJobsJobSpec[],
  jobKeyPreserveRunAt?: boolean, // if true, run_at not updated when a jobKey job is overwritten
) => Promise<ReadonlyArray<Job>>;

export interface AddJobsJobSpec {
  identifier: string;
  payload: unknown;
  queueName?: string;   // avoid high-cardinality values
  runAt?: Date;
  priority?: number;    // default 0
  maxAttempts?: number; // default 25
  jobKey?: string;
  flags?: string[];
}
```

```js
await addJobs([
  { identifier: "send_email", payload: { to: "[email protected]" } },
  { identifier: "send_email", payload: { to: "[email protected]" } },
]);
```

> `addJobs` does **not** support `unsafe_dedupe` (use single `add_job` calls for that). Its default behavior matches `job_key_mode='replace'`; pass `jobKeyPreserveRunAt: true` for `preserve_run_at`-like behavior.
