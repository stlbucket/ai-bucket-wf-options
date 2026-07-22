// pgTAP test runner (spec .claude/specs/db-testing/). Style A: each db/<pkg>/test/*.sql is one
// `BEGIN … plan() … finish() … ROLLBACK` transaction. Mirrors scripts/db-exec.ts — a `docker run`
// psql client on fnb-network, connecting via PG_URL. pgTAP + the `test` helper schema are created
// once (db/_test/setup.sql) outside the per-file txns and dropped after (db/_test/teardown.sql);
// every test file rolls back, so the dev DB is left untouched.
//
// Usage:
//   pnpm db-test                 # every db/*/test/*.sql
//   pnpm db-test fnb-todo        # one package
//   pnpm db-test fnb-todo 010    # files in one package whose basename starts with 010
import { spawnSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'
import { PG_URL, REPO_ROOT } from './_env'

const [pkgArg, prefixArg] = process.argv.slice(2)
const DB_DIR = resolve(REPO_ROOT, 'db')

// Run one .sql file through psql inside the postgres:18 client container (same image/network as
// db-exec). `-qtA -P pager=off` strips psql chrome so only bare TAP lines print. Returns psql's
// exit code + captured output. ON_ERROR_STOP makes an unexpected SQL error a non-zero exit;
// expected errors caught by throws_ok do not stop psql.
function psqlFile(absPath: string): { status: number; out: string } {
  const r = spawnSync(
    'docker',
    [
      'run', '--rm', '-i', '--network', 'fnb-network',
      '-v', `${absPath}:/tmp/t.sql:ro`,
      'postgres:18',
      'psql', PG_URL, '-q', '-t', '-A', '-P', 'pager=off', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/t.sql',
    ],
    { encoding: 'utf8' },
  )
  return { status: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

type TapResult = { ok: boolean; desc: string }
type Tap = { results: TapResult[]; planned: number | null; diags: string[] }

// Parse bare TAP: `1..N` plan, `ok N - desc` / `not ok N - desc` assertions, `# …` diagnostics.
function parseTap(out: string): Tap {
  const planMatch = out.match(/^\s*1\.\.(\d+)\s*$/m)
  const planned = planMatch ? parseInt(planMatch[1], 10) : null
  const results: TapResult[] = []
  const diags: string[] = []
  for (const raw of out.split('\n')) {
    const line = raw.replace(/\r$/, '')
    const m = line.match(/^\s*(ok|not ok)\s+\d+\s*-?\s*(.*)$/)
    if (m) {
      results.push({ ok: m[1] === 'ok', desc: m[2].trim() })
    } else if (line.trim().startsWith('#')) {
      diags.push(line.trim())
    } else if (/\bERROR\b/.test(line)) {
      diags.push(line.trim())
    }
  }
  return { results, planned, diags }
}

// A file passes iff psql exited 0, a plan was printed, the number of assertions run equals the
// plan, and none failed. (finish() emits TAP; we parse it — no dependency on finish(true).)
function evaluate(status: number, tap: Tap): boolean {
  const failed = tap.results.filter((r) => !r.ok).length
  return (
    status === 0 &&
    tap.planned !== null &&
    tap.results.length === tap.planned &&
    failed === 0
  )
}

function discover(): string[] {
  const pkgs = readdirSync(DB_DIR).filter((d) => {
    if (pkgArg && d !== pkgArg) return false
    const testDir = resolve(DB_DIR, d, 'test')
    return existsSync(testDir) && statSync(testDir).isDirectory()
  })
  const files: string[] = []
  for (const pkg of pkgs) {
    const testDir = resolve(DB_DIR, pkg, 'test')
    for (const f of readdirSync(testDir).sort()) {
      if (!f.endsWith('.sql')) continue
      if (prefixArg && !f.startsWith(prefixArg)) continue
      files.push(resolve(testDir, f))
    }
  }
  return files
}

function rel(p: string): string {
  return p.slice(REPO_ROOT.length + 1)
}

const files = discover()
if (files.length === 0) {
  console.error(
    `No test files found under db/${pkgArg ?? '*'}/test/${prefixArg ? ` (prefix ${prefixArg})` : ''}.`,
  )
  process.exit(1)
}

// ── setup (pgTAP + test helpers) ────────────────────────────────────────────────────────────
const setup = psqlFile(resolve(DB_DIR, '_test', 'setup.sql'))
if (setup.status !== 0) {
  console.error(setup.out)
  if (/pgtap|could not open extension|No such file/i.test(setup.out)) {
    console.error(
      '\n✗ pgTAP is not available in the db image.\n' +
        '  Rebuild the dev db image (bakes in the pgtap OS package), then retry:\n' +
        '    docker compose build db && docker compose up -d db\n' +
        '  See .claude/specs/db-testing/harness.md §1.',
    )
  }
  process.exit(1)
}

// ── run each test file (verbose: every assertion by name) ───────────────────────────────────
let failedFiles = 0
let totalAssertions = 0
let failedAssertions = 0
for (const f of files) {
  const { status, out } = psqlFile(f)
  const tap = parseTap(out)
  const pass = evaluate(status, tap)
  const failed = tap.results.filter((r) => !r.ok).length
  totalAssertions += tap.results.length
  failedAssertions += failed

  console.log(`\n${pass ? '✓' : '✗'} ${rel(f)}  (${tap.results.length - failed}/${tap.planned ?? '?'})`)
  for (const r of tap.results) console.log(`    ${r.ok ? '✓' : '✗'} ${r.desc}`)
  if (!pass) {
    failedFiles++
    // plan mismatch (file aborted mid-run) or a hard SQL error: show the diagnostics/stderr.
    if (tap.planned !== null && tap.results.length !== tap.planned) {
      console.log(`    ! ran ${tap.results.length} of ${tap.planned} planned assertions (file aborted)`)
    }
    for (const d of tap.diags) console.log(`    ${d}`)
  }
}

// ── teardown (best-effort; never flips the run result) ──────────────────────────────────────
const teardown = psqlFile(resolve(DB_DIR, '_test', 'teardown.sql'))
if (teardown.status !== 0) console.error(`(teardown warning)\n${teardown.out}`)

const okAssertions = totalAssertions - failedAssertions
console.log(
  `\n${failedFiles === 0 ? '✓' : '✗'} ${files.length - failedFiles}/${files.length} file(s), ` +
    `${okAssertions}/${totalAssertions} assertion(s) passed.`,
)
process.exit(failedFiles === 0 ? 0 : 1)
