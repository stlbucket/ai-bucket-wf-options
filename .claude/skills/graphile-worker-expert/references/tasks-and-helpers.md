# Task executors, helpers, batch jobs, and TypeScript

## The task executor function

A task executor is an async JS function `(payload, helpers) => { ... }`:
- **`payload`** — the JSON payload passed to `add_job(...)` / `addJob(...)`.
- **`helpers`** — utilities scoped to this job (see below).

Success/failure contract: **return → success → job deleted** (unless it's a batch job with partial success); **throw/reject → failure → retried with exponential backoff**.

> The #1 correctness rule: **await all asynchronous work before returning.** Never create untethered promises; if you don't await them, worker may consider the job successful prematurely.

Because worker auto-retries, it's often best to split a large job into multiple smaller jobs — this enables parallelism and is safer for non-idempotent work (e.g. sending emails, where a re-run causes duplicate sends).

### Examples

```js
// tasks/task_1.js
module.exports = async (payload) => {
  await doMyLogicWith(payload);
};
```

```js
// tasks/task_2.js
module.exports = async (payload, helpers) => {
  helpers.logger.debug(`Received ${JSON.stringify(payload)}`);
};
```

## The task directory

Worker scans the configured `taskDirectory` for files to run as tasks. File/folder names (excluding extension) must match `/^[A-Za-z0-9_-]+$/`. The **task identifier** is the folder path + filename (no extension), joined with `/`:
- `${taskDirectory}/send_notification.js` → `send_notification`
- `${taskDirectory}/users/emails/verify.js` → `users/emails/verify`

### Loading JavaScript

Default preset loads `.js`, `.cjs`, `.mjs` via `import()`. CommonJS files must set `module.exports` to the executor; ESM files must default-export it.

### Loading TypeScript

Recommended: compile TS → JS and load the JS (better performance/memory). To load `.ts` directly without precompilation:
1. Install `ts-node`.
2. Add `.ts` (and `.cts`/`.mts` as needed) to `worker.fileExtensions`.
3. Run with `NODE_OPTIONS="--loader ts-node/esm"`.

```ts
// graphile.config.ts
import { WorkerPreset } from "graphile-worker";
const preset: GraphileConfig.Preset = {
  extends: [WorkerPreset],
  worker: {
    connectionString: process.env.DATABASE_URL,
    concurrentJobs: 5,
    fileExtensions: [".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"],
  },
};
export default preset;
```

```bash
NODE_OPTIONS="--loader ts-node/esm" graphile-worker -c ...
```

### Loading executable files *(experimental, Linux/Unix/macOS)*

An executable file in the task directory becomes a task executor. Worker runs it with relevant env vars and feeds the payload per the encoding; **exit code 0 = success**, anything else = failure.

Env vars passed to the executable:
- `GRAPHILE_WORKER_PAYLOAD_FORMAT` — payload encoding (currently `"json"`; check it before processing in case it changes).
- `GRAPHILE_WORKER_TASK_IDENTIFIER` — the task identifier (useful when one binary serves several identifiers, e.g. via symlinks).
- `GRAPHILE_WORKER_JOB_ID` — job ID.
- `GRAPHILE_WORKER_JOB_KEY` — the job's `job_key`, if any.
- `GRAPHILE_WORKER_JOB_ATTEMPTS` — attempts made (starts at 1).
- `GRAPHILE_WORKER_JOB_MAX_ATTEMPTS` — max attempts.
- `GRAPHILE_WORKER_JOB_PRIORITY` — numeric priority.
- `GRAPHILE_WORKER_JOB_RUN_AT` — scheduled run time (use to detect delayed jobs).

JSON payload format: the binary receives `JSON.stringify({ payload })` on stdin. e.g. `addJob('my_script', { mol: 42 })` sends `{"payload":{"mol":42}}`.

## `helpers`

- **`helpers.logger`** — logger scoped to this job (`error`/`warn`/`info`/`debug`). See operations reference.
- **`helpers.job`** — the whole currently-executing job (`id`, `attempts`, etc.).
- **`helpers.addJob()`** / **`helpers.addJobs()`** — enqueue more jobs (see library-api.md).
- **`helpers.getQueueName(queueId?)`** — queue name for the given queue id (or the current job's queue if omitted). May or may not return a promise — always `await` it.
- **`helpers.query(sql, values)`** — convenience for `withPgClient(c => c.query(sql, values))`.
- **`helpers.withPgClient(cb)`** — borrows a `pgClient` from worker's pool, runs `await cb(pgClient)`, releases the client, returns the result. Great for testability.
  ```js
  const { rows: [row] } =
    await withPgClient((pgClient) => pgClient.query("select 1 as one"));
  ```
  Note: neither `withPgClient` nor `query` opens a transaction. If you need one, manage it yourself — but keeping transactions open hurts worker performance by increasing contention on the DB client pool.
- **`helpers.abortSignal`** *(experimental)* — an `AbortSignal` triggered when the job should exit early (e.g. graceful shutdown). Pass it to abortable Node APIs like `http.request()`.
- **`helpers.abortPromise`** *(experimental)* — a promise that rejects when `abortSignal` aborts. Convenient for `Promise.race([abortPromise, doYourAsyncThing()])`.

## Batch jobs (executor side)

If `payload` is an array of objects, the task is a **batch job**. The executor may optionally return an array of promises of the *same length* as the payload. If some promises reject, the job has "partial success": it's re-enqueued with the payload trimmed to only the failed entries (successful ones removed). Combined with `job_key` array-payload merging, this enables accumulating events into a single job over a time window (see job-key.md). See also the `process_invoices`/notification batching examples there.

## TypeScript payload typing

By default `payload` is typed `unknown` (jobs may come from old code or other sources). Two approaches:

### Recommended: assertion functions

Validate at runtime so old/out-of-band jobs can't smuggle bad data.

```ts
import type { Task } from "graphile-worker";
import { ses } from "./aws";

interface Payload { to: string; subject: string; body: string; from?: string; }

function assertPayload(payload: any): asserts payload is Payload {
  if (typeof payload !== "object" || !payload) throw new Error("invalid");
  if (typeof payload.to !== "string") throw new Error("invalid");
  if (typeof payload.subject !== "string") throw new Error("invalid");
  if (typeof payload.body !== "string") throw new Error("invalid");
  if (typeof payload.from !== "string" && typeof payload.from !== "undefined")
    throw new Error("invalid");
}

export const send_email: Task = async function (payload) {
  assertPayload(payload);
  const { to, subject, body, from } = payload;
  await ses.sendEmail({ /* ... use from ?? default ... */ });
};
```

Libraries like `runtypes` (and similar) can reduce the boilerplate. When you add a new optional field later, update both the interface and the assertion, accounting for jobs queued before the field existed.

### Alternative: assume type via `GraphileWorker.Tasks`

Register payload types globally to get autocomplete and inference for `addJob`/`addJobAdhoc` and task functions:

```ts
declare global {
  namespace GraphileWorker {
    interface Tasks {
      send_email: { to: string; subject: string; body: string };
      // myTaskIdentifier: { details: "are"; specified: "here" };
    }
  }
}

const task: Task<"send_email"> = async (payload, helpers) => {
  const { to, subject, body } = payload; // typed
};

// or in a TaskList:
const tasks: TaskList = {
  async send_email(payload, helpers) { /* typed */ },
};
```

> **Caveat (important):** this is *assumed*, not *checked*. Jobs created via `graphile_worker.add_job()`/`.add_jobs()` in SQL bypass TS checks entirely, and old jobs may use an outdated shape — so a field you typed as `number` might actually be `null`, causing bugs. Worker's docs recommend assertion functions over assumed types for this reason. Keep these `declare global` blocks in a shared file.
