# Configuration

Graphile Worker's common options are configured via a **Graphile Config preset** — a JS object with keys like `extends` (merge other presets), `plugins`, and a `worker` key holding worker-specific settings. A dedicated config file isn't required, but is strongly recommended so CLI and library modes share configuration, and so tooling works.

Recommended: make the preset the default export of `graphile.config.js` (or `.ts`, `.mjs`, etc.).

## Example presets

JavaScript (`graphile.config.js`):

```js
const { WorkerPreset } = require("graphile-worker");

module.exports = {
  extends: [WorkerPreset],
  worker: {
    connectionString: process.env.DATABASE_URL,
    maxPoolSize: 10,
    pollInterval: 2000,
    preparedStatements: true,
    schema: "graphile_worker",
    crontabFile: "crontab",
    concurrentJobs: 1,
    fileExtensions: [".js", ".cjs", ".mjs"],
  },
};
```

TypeScript (`graphile.config.ts`):

```ts
import { WorkerPreset } from "graphile-worker";

const preset: GraphileConfig.Preset = {
  extends: [WorkerPreset],
  worker: {
    connectionString: process.env.DATABASE_URL,
    maxPoolSize: 10,
    pollInterval: 2000,
    preparedStatements: true,
    schema: "graphile_worker",
    crontabFile: "crontab",
    concurrentJobs: 1,
    fileExtensions: [".js", ".cjs", ".mjs"],
  },
};

export default preset;
```

## Tooling (`graphile` command)

With a config file present:
- `graphile config print` — prints the resolved configuration, nicely formatted.
- `graphile config options` — lists available options based on your plugins/presets (handy when plugins add options). You can also rely on TypeScript autocomplete.

## CLI vs library precedence

**CLI mode** resolves config as: default Worker Preset → your config-file preset → CLI flags (flags win).

**Library mode**: many exported functions accept a preset, including `run()`, `runMigrations()`, `runOnce()`, `makeWorkerUtils()`, `addJobAdhoc()` (formerly `quickAddJob`), and more. Worker is transitioning library config to presets, so there's currently overlap between preset options and direct options-object properties. **If a setting is given both ways, the direct property wins over the preset.** Note names don't always match: legacy `concurrency` corresponds to preset `concurrentJobs`.

```ts
const runner = await runOnce({
  taskDirectory: `${__dirname}/tasks`,
  connectionString: "postgres:///my_db",
  concurrency: 2, // legacy name; wins over preset's concurrentJobs
  preset: {
    worker: {
      connectionString: "ignored", // overridden by the direct property above
      concurrentJobs: 1,
    },
  },
});
```

Using a config file with library mode:

```ts
// graphile.config.ts
import { WorkerPreset } from "graphile-worker";
const preset: GraphileConfig.Preset = {
  extends: [WorkerPreset],
  worker: {
    taskDirectory: `${__dirname}/tasks`,
    connectionString: "postgres:///my_db",
  },
};
export default preset;
```

```ts
// index.ts
import { run } from "graphile-worker";
import preset from "./graphile.config";

async function main() {
  const runner = await run({ preset });
  await runner.promise;
}
main().catch((err) => { console.error(err); process.exit(1); });
```

## `worker` options reference

The exact set depends on plugins/presets in use. With no plugins/presets, the `worker` key supports:

```ts
{
  concurrentJobs?: number;
  connectionString?: string;
  crontabFile?: string;
  events?: WorkerEvents;
  fileExtensions?: string[];
  getQueueNameBatchDelay?: number;
  gracefulShutdownAbortTimeout?: number;
  logger?: Logger<{}>;
  maxPoolSize?: number;
  maxResetLockedInterval?: number;
  minResetLockedInterval?: number;
  pollInterval?: number;
  preparedStatements?: boolean;
  schema?: string;
  taskDirectory?: string;
  useNodeTime?: boolean;
}
```

- **`concurrentJobs`** — number of jobs to run concurrently on a single worker instance.
- **`connectionString`** — Postgres connection string.
- **`crontabFile`** — path to the crontab schedule file (see cron reference).
- **`events`** — supply your own Node `EventEmitter` to receive events (including early startup events before the run promise resolves). See WorkerEvents in the operations reference.
- **`fileExtensions`** — extensions (priority order) to import as task modules from the task directory; default `[".js", ".cjs", ".mjs"]`.
- **`getQueueNameBatchDelay`** *(experimental)* — ms window over which queue-name lookups are batched; larger = more efficient, smaller = lower latency.
- **`gracefulShutdownAbortTimeout`** — ms after a graceful shutdown begins before the AbortController fires to cancel supported async actions.
- **`logger`** — a custom `Logger` instance (see operations reference).
- **`maxPoolSize`** — max concurrent Postgres connections; must be ≥2. May be lower than `concurrentJobs`, but a low pool can stall job start/release. Recommended: `10` or `concurrentJobs + 2`, whichever is larger. If your task executors also use this pool, you may need more.
- **`maxResetLockedInterval`** / **`minResetLockedInterval`** *(experimental)* — bounds (ms) for how often worker scans for and releases jobs that have been locked too long; worker picks a time between the two.
- **`pollInterval`** — ms between polls for future/retry jobs.
- **`preparedStatements`** — set `false` if your Postgres pool (e.g. some poolers) doesn't support prepared statements.
- **`schema`** — schema for worker's tables/functions/views; worker creates/edits as needed. Default `graphile_worker`.
- **`taskDirectory`** — directory to load task executors from.
- **`useNodeTime`** — set `true` to use Node's time instead of Postgres's. Better to keep Node and Postgres clocks synchronized and leave this off.

## Environment variables

Some default-preset options fall back to env vars (custom preset values and CLI flags take precedence):

```ts
{
  connectionString: process.env.DATABASE_URL,
  schema: process.env.GRAPHILE_WORKER_SCHEMA,
}
```
