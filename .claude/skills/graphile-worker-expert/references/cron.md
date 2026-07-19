# Recurring tasks (crontab)

For jobs that should be created automatically on a schedule (weekly emails, daily maintenance, hourly roll-ups, etc.). Worker's crontab:
- guarantees no duplicate schedules (ACID transactions),
- can optionally **backfill** missed jobs (e.g. if the worker was down when due),
- schedules through the normal job queue (so you get retries/backoff/etc.),
- works across multiple workers with no special setup.

> Don't add a recurring task per application user. Keep recurring tasks few; have them create per-user jobs or process multiple users as needed.

By default the schedule is read from a `crontab` file next to the `tasks/` folder (configurable in library mode). **Timestamps are UTC only**, and the syntax is *not* 100% standard cron (and the payload differs).

## Crontab format

```crontab
# ┌───────────── UTC minute (0 - 59)
# │ ┌───────────── UTC hour (0 - 23)
# │ │ ┌───────────── UTC day of month (1 - 31)
# │ │ │ ┌───────────── UTC month (1 - 12)
# │ │ │ │ ┌───────────── UTC day of week (0 - 6) (Sun - Sat)
# │ │ │ │ │ ┌───────────── task identifier to schedule
# │ │ │ │ │ │    ┌────────── optional scheduling options
# │ │ │ │ │ │    │     ┌────── optional payload to merge
# * * * * * task ?opts {payload}
```

- Comment lines start with `#`.
- For the 5 time fields: explicit numbers, `*` (all), `*/n` (divisible by n), ranges like `1-5`, and comma-combinations of these.
- Task identifier must match `/^[_a-zA-Z][_a-zA-Z0-9:_-]*$/` and be one of your tasks.

### `opts` (always prefixed with `?`, HTTP-query-string syntax, `&`-separated)

- **`id=UID`** — unique alphanumeric (case-sensitive, starts with a letter) identifier for this crontab entry. Defaults to the task identifier; **required** if you want more than one schedule for the same task.
- **`fill=t`** — backfill entries from the last time period `t` (a "time phrase", see below) if they were missed; default: no backfill.
- **`max=n`** — override `max_attempts`.
- **`queue=name`** — add to a named queue (serial execution).
- **`jobKey=key`** — replace/update the existing job with this key.
- **`jobKeyMode=replace|preserve_run_at`** — affects `jobKey` behavior.
- **`priority=n`** — override priority.

> Changing the identifier (e.g. via `id`) can cause duplicate executions — set it explicitly and never change it. `fill` only backfills *previously known* tasks. A larger `fill` increases worker startup time; set it slightly larger than the longest expected downtime.

#### Time phrases

Sequences of number+letter, e.g. `5d` = five days, `4w3d2h1m` = 4 weeks, 3 days, 2 hours, 1 minute. Units: `s` (second), `m` (minute), `h` (hour), `d` (day), `w` (week).

### `payload`

A JSON5 object: must start with `{`, no newlines/carriage returns, no trailing whitespace. It's merged into the default crontab payload. Every crontab job's payload includes a `_cron` key:
- **`_cron.ts`** — ISO8601 timestamp of when this job was due to execute.
- **`_cron.backfilled`** — `true` if it was backfilled (not scheduled on time), else `false`.

## Examples

```text
# Mondays 04:30 UTC
30 4 * * 1 send_weekly_email

# Same, but backfill last 2 days, max 10 attempts, merge payload
30 4 * * 1 send_weekly_email ?fill=2d&max=10 {onboarding:false}

# Every 4 hours on the hour
0 */4 * * * rollup
```

## Distributed crontab

**Identical crontabs on multiple workers → Just Works.** The first worker to queue a given cron job wins; others no-op (ACID transactions + the `known_crontabs` lock table). If workers have **different** crontabs, ensure cron items have unique identifiers (set `id=` explicitly), or overlapping derived identifiers at the same timestamp will mean only one schedules.

## Limiting backfill

You can only bound backfill by the **period** itself — there's no "backfill at most one" or "skip if next job is soon." This is deliberate (back-off, overloaded workers, serial jobs, etc. could otherwise produce surprising outcomes). Implement such constraints **at runtime** in the task executor, using `payload._cron.ts` to decide whether to proceed.

## Library mode

Three ways to specify cron items:
1. **`crontab`** — a crontab string (like the file's contents).
2. **`crontabFile`** — path to a crontab file.
3. **`parsedCronItems`** — explicit parsed items (opaque type; don't construct manually).

Build `parsedCronItems` with a helper:
- **`parseCrontab(string)`** — crontab string → `ParsedCronItem[]`.
- **`parseCronItems(CronItem[])`** — `CronItem[]` → `ParsedCronItem[]`.

`CronItem` (human/script-authored):
- **`task`** *(required)* — task identifier (like `add_job`'s first arg).
- **`match`** *(required)* — a cron pattern (e.g. `* * * * *`) or a callback `(TimestampDigest) => boolean` deciding whether to fire.
- **`options`** — `backfillPeriod` (ms), `maxAttempts`, `queueName`, `priority`.
- **`payload`** — object merged into the generated payload.
- **`identifier`** — permanent unique identifier; defaults to `task`. Required when scheduling the same task multiple times (every cron item must be uniquely identified).
