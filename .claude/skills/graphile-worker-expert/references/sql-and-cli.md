# SQL functions, triggers, CLI, and connection strings

## Adding jobs through SQL

Schedule jobs directly in the database — from a trigger, a function, or application SQL — using `graphile_worker.add_job` (or experimental `graphile_worker.add_jobs` for bulk). The JS `addJob` simply defers to this.

### `graphile_worker.add_job()`

Parameters, in order:
- **`identifier`** *(required)* — task executor name (omit any `.js` suffix).
- **`payload`** — JSON object with task context, or an array of such objects for batch jobs (default: empty object).
- **`queue_name`** — run certain tasks one-at-a-time by putting them in the same named queue. **Avoid high-cardinality values** (random strings, UUIDs, timestamps) — they create dead queues, degrade performance, and require periodic cleanup. Default `null`.
- **`run_at`** — timestamp after which to run; default now.
- **`max_attempts`** — retry count; default `25` (must cast to `smallint`).
- **`job_key`** — unique key to replace/update/remove/dedupe later (see job-key.md).
- **`priority`** — integer; numerically smaller runs first; default `0` (must cast to `smallint`).
- **`flags`** — `text[]` of flags; pairs with `forbiddenFlags` for runtime filtering / rate limiting.
- **`job_key_mode`** — when `job_key` matches an existing job: `replace` (default), `preserve_run_at`, or `unsafe_dedupe` (see job-key.md for full semantics).

Typical call:

```sql
SELECT graphile_worker.add_job(
  'send_email',
  json_build_object('to', '[email protected]', 'subject', 'graphile-worker test')
);
```

Use **named parameters** so you only specify what you need:

```sql
SELECT graphile_worker.add_job('reminder', run_at := NOW() + INTERVAL '2 days');
```

Delay by a variable number of seconds using **database** time (not app time) via interval multiplication:

```sql
SELECT graphile_worker.add_job(
  $1,
  payload := $2,
  queue_name := $3,
  max_attempts := $4,
  run_at := NOW() + ($5 * INTERVAL '1 second')
);
```

> **Privileges:** `add_job` requires database-owner privileges. To let a lower-privileged role call it (e.g. via PostGraphile/PostgREST), wrap it in a PostgreSQL function marked `SECURITY DEFINER` so it runs with the definer's privileges — and have that wrapper perform any necessary access checks.

### Example: simple trigger

Enqueue a job whenever a row is inserted:

```sql
CREATE FUNCTION my_table_created() RETURNS trigger AS $$
BEGIN
  PERFORM graphile_worker.add_job('task_identifier_here', json_build_object('id', NEW.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER trigger_name AFTER INSERT ON my_table
  FOR EACH ROW EXECUTE PROCEDURE my_table_created();
```

### Example: one generic trigger function

If your tables all use a single PK named `id`, a reusable dynamic trigger function can serve many tables/triggers:

```sql
CREATE FUNCTION trigger_job() RETURNS trigger AS $$
BEGIN
  PERFORM graphile_worker.add_job(TG_ARGV[0], json_build_object(
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

Wire it up with `WHEN(...)` conditions to avoid unnecessary jobs:

```sql
CREATE TRIGGER send_verification_email
  AFTER INSERT ON user_emails
  FOR EACH ROW WHEN (NEW.verified is false)
  EXECUTE PROCEDURE trigger_job('send_verification_email');

CREATE TRIGGER user_changed
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE PROCEDURE trigger_job('user_changed');

CREATE TRIGGER generate_pdf_update
  AFTER UPDATE ON pdfs
  FOR EACH ROW WHEN (NEW.title IS DISTINCT FROM OLD.title)
  EXECUTE PROCEDURE trigger_job('generate_pdf');
```

### `graphile_worker.add_jobs()` *(experimental; may change in a minor release)*

Bulk insert. Options:
- **`specs`** — array of `graphile_worker.job_spec` objects.
- **`job_key_preserve_run_at`** — optional boolean; preserve `run_at` when the same `job_key` recurs.

`job_spec` properties mirror `add_job`: `identifier`, `payload`, `queue_name`, `run_at`, `max_attempts`, `job_key`, `priority`, `flags`.

> `job_key_mode='unsafe_dedupe'` is **not** supported in `add_jobs` (use `add_job` one at a time). Default behavior equals `replace`; set `job_key_preserve_run_at = true` for `preserve_run_at`-like behavior.

## CLI

Run the worker, passing the connection string via `-c`. Worker manages its own `graphile_worker` schema and creates/updates it on startup.

```bash
npx graphile-worker -c "postgres:///my_db"
```

> `npx` runs a locally installed binary; for real use, prefer a `package.json` `"scripts"` entry. Worker expects the **same Postgres role at runtime as during migrations**; if migrations run as a different role, change ownership of the `graphile_worker.*` tables to the runtime role.

### CLI options (`graphile-worker --help`)

- `-c, --connection` — connection string (defaults to `DATABASE_URL`).
- `-s, --schema` — schema where worker lives.
- `--schema-only` — install/update the schema then exit.
- `--once` — run until no runnable jobs remain, then exit.
- `--crontab` — override path to the crontab file.
- `-j, --jobs` — number of jobs to run concurrently.
- `-m, --max-pool-size` — max Postgres pool size.
- `--poll-interval` — ms between polls (for future/retry jobs).
- `--no-prepared-statements` — disable prepared statements (e.g. external pooler compatibility).
- `-C, --config` — path to the config file.
- `--cleanup` — clean the DB then exit; comma-separated tasks: `GC_TASK_IDENTIFIERS`, `GC_JOB_QUEUES`, `DELETE_PERMAFAILED_JOBS` (see operations reference).

## Connection strings

Most common form:

```text
postgres://user:password@host:port/dbname
```

`pg://` and `postgresql://` are generally equivalent, but `postgres://` is the most compatible across the ecosystem. General shape (square brackets optional):

```text
postgres://[user[:password]@][host[:port]]/[dbname][?...]
```

- **TCP socket:** specify host (and port if not 5432). Using `localhost` may still use a domain socket; use `127.0.0.1` to force TCP.
- **TCP + SSL:** add `?ssl=true`. Other SSL params (e.g. `?sslrootcert=/path/to/cert.pem`) depend on the `pg`/`pg-connection-string` version. For Amazon RDS, force SSL and point `sslrootcert` at the full path of the RDS CA bundle.
- **Domain socket:** omit host/port and pass it as a query param, e.g. `postgres:///dbname?host=/path/to/socket` or `postgres://user:pass@/dbname?host=/path/to/socket`.

Examples:
- `postgres:///my_db` — db `my_db` on localhost:5432
- `postgres://127.0.0.1:5432/my_db`
- `postgres://postgres:password@127.0.0.1:5432/my_db?ssl=1`
