# Job key: replace, update, remove, debounce, throttle, dedupe

A **job key** lets you identify a job later to replace, update, or remove it — and is the basis for de-duplication, debouncing, and throttling. Set it via `job_key` (SQL) / `jobKey` (JS).

> Read the caveats at the bottom — several are easy to get wrong.

## Replacing / updating jobs

Calling `add_job` again with the same `job_key` replaces/updates the existing (unlocked) job. Useful for rescheduling, ensuring only one of a job is scheduled at a time, or updating settings. If no match exists, a new job is created.

After this transaction, `send_email` runs once with payload `{"count": 2}`:

```sql
BEGIN;
SELECT graphile_worker.add_job('send_email', '{"count": 1}', job_key := 'abc');
SELECT graphile_worker.add_job('send_email', '{"count": 2}', job_key := 'abc');
COMMIT;
```

## `job_key_mode`

Controls behavior when a matching job key is found:

- **`replace` (default)** — overwrite the unlocked job with new values (merging array payloads), **including `run_at`**. Good for rescheduling, updating, and **debouncing** (delay execution until events stop for a period — each new event pushes `run_at` forward). Locked jobs cause a *new* job to be scheduled instead.
- **`preserve_run_at`** — overwrite the unlocked job (merging array payloads) but **keep the original `run_at`**. Good for **throttling** (execute at most once per period — the first event sets the time, later ones just update the payload). Locked jobs cause a new job to be scheduled.
- **`unsafe_dedupe`** — if any matching job exists — **even if locked or permanently failed** — do nothing (no update). Dangerous: the triggering event may produce no action. Avoid unless you're certain.

### Full algorithm

- No existing job with the key → create a new job with the new attributes.
- Else if `unsafe_dedupe` → stop, return the existing job.
- Else if the existing job is **locked** → clear its `key`, set its `attempts = max_attempts` (so it won't run again), and create a new job with the new attributes.
- Else if the existing job has **previously failed** → reset `attempts` to 0, clear `last_error`, and update **all** attributes to new values **including `run_at`** (even under `preserve_run_at`).
- Else if `preserve_run_at` → update all attributes **except `run_at`**.
- Else → update all attributes to new values.

## Array payload merging

When updating via `job_key` (except `unsafe_dedupe`), if **both** the existing and new payloads are JSON arrays, they're **concatenated** rather than overwritten. This enables batching multiple events into one job.

```sql
-- Creates job with payload [{"id": 1}]
SELECT graphile_worker.add_job('process_events', '[{"id": 1}]'::json,
  job_key := 'my_batch', job_key_mode := 'preserve_run_at',
  run_at := NOW() + INTERVAL '10 seconds');

-- Before it runs, merges to [{"id": 1}, {"id": 2}]
SELECT graphile_worker.add_job('process_events', '[{"id": 2}]'::json,
  job_key := 'my_batch', job_key_mode := 'preserve_run_at',
  run_at := NOW() + INTERVAL '10 seconds');
```

- With **`preserve_run_at`** → fixed batching window: runs at the originally scheduled time with all accumulated payloads.
- With **`replace`** (default) → each event pushes `run_at` forward → rolling/debounce window.

> **Both payloads must be arrays for merging.** If either is a non-array (e.g. the default empty object when no payload is specified), standard replace applies and the old payload is **lost**.

## Removing jobs

```sql
SELECT graphile_worker.remove_job('abc');
```

## Caveats (read these)

- **No permanent key log.** Successful jobs are deleted, so `remove_job` on a completed key is a no-op (no row exists).
- **Keys are universally unique** while a job is pending/failed — you can even change a job's `task_identifier` or `payload` via the same key. Ensure keys are unique enough that you don't clobber unrelated jobs; a good practice is to **incorporate the `task_identifier` into the `job_key`**.
- **Updating a locked (running) job** schedules a *second* job (unless `unsafe_dedupe`), so both run. The old job is prevented from running again and has its key removed.
- **`remove_job` on a locked (running) job** doesn't remove it, but prevents it from running again on failure.
- **Race condition under high contention:** adding a job with a key can occasionally fail and return `null`. Check for `null` and handle it (retry, throw, etc.). See https://github.com/graphile/worker/issues/580.
- Error `GWBKM` means an invalid `job_key_mode` (expected `replace`, `preserve_run_at`, or `unsafe_dedupe`).
