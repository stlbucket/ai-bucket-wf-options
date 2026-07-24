import { execSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PG_URL, REPO_ROOT } from './_env'

// Captures the entire live DB structure as psql-native text files (one file per object) into a
// TEMP capture tree, then emits the db-structure.data.js rollup consumed by the hand-written
// index.html tree browser. Contract: .claude/specs/db-introspect/db-structure.data.md.
// Only index.html (hand-written) + db-structure.data.js live in docs/db-structure/ — the
// per-object files are a build intermediate, never committed (user decision 2026-07-24).
// Regeneration wipes everything under docs/db-structure/ EXCEPT index.html.

const OUT_ROOT = join(REPO_ROOT, 'docs', 'db-structure')

interface Rel {
  schema: string
  name: string
}
interface Fn extends Rel {
  oid: number
  args: string
}
interface Trg {
  schema: string
  table: string
  name: string
  oid: number
}
interface Inventory {
  schemas: string[]
  tables: Rel[]
  views: Rel[]
  matviews: Rel[]
  foreignTables: Rel[]
  sequences: Rel[]
  functions: Fn[]
  enums: Rel[]
  types: Rel[]
  domains: Rel[]
  triggers: Trg[]
}

// Non-system schemas only; objects owned by extensions (pg_depend deptype='e') are excluded —
// pgcrypto/uuid-ossp/citext alone contribute ~93 noise functions in public. \dx+ in the
// overview documents extensions instead.
const SCHEMA_FILTER = `n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'`
const notExtension = (classid: string, oidExpr: string) => `not exists (
      select 1 from pg_depend d
      where d.classid = '${classid}'::regclass and d.objid = ${oidExpr} and d.deptype = 'e'
    )`

const relKind = (kinds: string) => `(
    select coalesce(json_agg(json_build_object('schema', n.nspname, 'name', c.relname)
                    order by n.nspname, c.relname), '[]'::json)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in (${kinds}) and ${SCHEMA_FILTER}
      and ${notExtension('pg_class', 'c.oid')}
  )`

const typeKind = (where: string) => `(
    select coalesce(json_agg(json_build_object('schema', n.nspname, 'name', t.typname)
                    order by n.nspname, t.typname), '[]'::json)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where ${where} and ${SCHEMA_FILTER}
      and ${notExtension('pg_type', 't.oid')}
  )`

const INVENTORY_SQL = `select json_build_object(
  'schemas', (
    select coalesce(json_agg(n.nspname order by n.nspname), '[]'::json)
    from pg_namespace n
    where ${SCHEMA_FILTER}
      and ${notExtension('pg_namespace', 'n.oid')}
  ),
  'tables', ${relKind(`'r','p'`)},
  'views', ${relKind(`'v'`)},
  'matviews', ${relKind(`'m'`)},
  'foreignTables', ${relKind(`'f'`)},
  'sequences', ${relKind(`'S'`)},
  'functions', (
    select coalesce(json_agg(json_build_object(
        'schema', n.nspname, 'name', p.proname, 'oid', p.oid::bigint,
        'args', pg_get_function_identity_arguments(p.oid))
      order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind in ('f','p') and ${SCHEMA_FILTER}
      and ${notExtension('pg_proc', 'p.oid')}
  ),
  'enums', ${typeKind(`t.typtype = 'e'`)},
  'types', (
    select coalesce(json_agg(json_build_object('schema', n.nspname, 'name', t.typname)
                    order by n.nspname, t.typname), '[]'::json)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_class c on c.oid = t.typrelid
    where t.typtype = 'c' and c.relkind = 'c' and ${SCHEMA_FILTER}
      and ${notExtension('pg_type', 't.oid')}
  ),
  'domains', ${typeKind(`t.typtype = 'd'`)},
  'triggers', (
    select coalesce(json_agg(json_build_object(
        'schema', n.nspname, 'table', c.relname, 'name', t.tgname, 'oid', t.oid::bigint)
      order by n.nspname, c.relname, t.tgname), '[]'::json)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and ${SCHEMA_FILTER}
  )
);
`

// ---------------------------------------------------------------------------------------------
// Step 1 — inventory (psql call #1)

const scratch = mkdtempSync(join(tmpdir(), 'db-introspect-'))
const CAP_ROOT = join(scratch, 'out') // temp capture tree — psql \o writes land here
writeFileSync(join(scratch, 'inventory.sql'), INVENTORY_SQL)

const raw = execSync(
  `docker run --rm -i --network fnb-network -v "${scratch}:/work" postgres:18` +
    ` psql "${PG_URL}" --no-psqlrc -tA -v ON_ERROR_STOP=1 -f /work/inventory.sql`,
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
)
const inv: Inventory = JSON.parse(raw.trim())

// Foreign tables are relations too — they browse under tables/ (\d+ works identically).
const allTables = [...inv.tables, ...inv.foreignTables].sort(
  (a, b) => a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name),
)

// Deterministic overload naming: same-name functions sorted by identity-argument string; the
// first keeps <name>.sql, then <name>__2.sql, <name>__3.sql …
const fnFile = new Map<Fn, string>()
{
  const groups = new Map<string, Fn[]>()
  for (const f of inv.functions) {
    const key = `${f.schema}.${f.name}`
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  for (const overloads of groups.values()) {
    overloads.sort((a, b) => a.args.localeCompare(b.args))
    overloads.forEach((f, i) => fnFile.set(f, i === 0 ? `${f.name}.sql` : `${f.name}__${i + 1}.sql`))
  }
}

// kind → { dir name, items per schema }. Fixed category order for the tree + rollup.
const KIND_ORDER = [
  'tables',
  'views',
  'matviews',
  'sequences',
  'enums',
  'types',
  'domains',
  'functions',
  'triggers',
] as const
type Kind = (typeof KIND_ORDER)[number]

interface Item {
  name: string // leaf label (file stem — unique within its category)
  file: string // path relative to docs/db-structure/
  commands: string[] // psql lines that produce the file (\o line excluded)
}

const bySchema = new Map<string, Map<Kind, Item[]>>()
for (const s of inv.schemas) bySchema.set(s, new Map())
const add = (schema: string, kind: Kind, item: Item) => {
  const cats = bySchema.get(schema)
  if (!cats) return // object in a schema filtered from the schema list — skip
  cats.set(kind, [...(cats.get(kind) ?? []), item])
}

for (const t of allTables)
  add(t.schema, 'tables', {
    name: t.name,
    file: `${t.schema}/tables/${t.name}.txt`,
    commands: [`\\d+ ${t.schema}.${t.name}`],
  })
for (const v of inv.views)
  add(v.schema, 'views', {
    name: v.name,
    file: `${v.schema}/views/${v.name}.txt`,
    commands: [`\\d+ ${v.schema}.${v.name}`],
  })
for (const m of inv.matviews)
  add(m.schema, 'matviews', {
    name: m.name,
    file: `${m.schema}/matviews/${m.name}.txt`,
    commands: [`\\d+ ${m.schema}.${m.name}`],
  })
for (const s of inv.sequences)
  add(s.schema, 'sequences', {
    name: s.name,
    file: `${s.schema}/sequences/${s.name}.txt`,
    commands: [`\\d+ ${s.schema}.${s.name}`],
  })
for (const e of inv.enums)
  add(e.schema, 'enums', {
    name: e.name,
    file: `${e.schema}/enums/${e.name}.txt`,
    commands: [`\\dT+ ${e.schema}.${e.name}`],
  })
for (const t of inv.types)
  add(t.schema, 'types', {
    name: t.name,
    file: `${t.schema}/types/${t.name}.txt`,
    commands: [`\\d ${t.schema}.${t.name}`],
  })
for (const d of inv.domains)
  add(d.schema, 'domains', {
    name: d.name,
    file: `${d.schema}/domains/${d.name}.txt`,
    commands: [`\\dD+ ${d.schema}.${d.name}`],
  })
for (const f of inv.functions) {
  const file = fnFile.get(f)!
  add(f.schema, 'functions', {
    name: file.replace(/\.sql$/, ''),
    file: `${f.schema}/functions/${file}`,
    // Leading comment so overload files self-identify; \qecho writes to the \o target.
    commands: [`\\qecho -- ${f.schema}.${f.name}(${f.args})`, `SELECT pg_get_functiondef(${f.oid});`],
  })
}
for (const t of inv.triggers)
  add(t.schema, 'triggers', {
    name: `${t.table}__${t.name}`,
    file: `${t.schema}/triggers/${t.table}__${t.name}.sql`,
    commands: [`SELECT pg_get_triggerdef(${t.oid}, true);`],
  })

// ---------------------------------------------------------------------------------------------
// Step 2 — wipe docs/db-structure/ (preserving index.html; the rollup is rewritten below) +
// pre-create the temp capture tree (\o cannot mkdir)

mkdirSync(OUT_ROOT, { recursive: true })
for (const entry of readdirSync(OUT_ROOT)) {
  if (entry === 'index.html') continue
  rmSync(join(OUT_ROOT, entry), { recursive: true, force: true })
}
mkdirSync(join(CAP_ROOT, '_overview'), { recursive: true })
for (const [schema, cats] of bySchema) {
  mkdirSync(join(CAP_ROOT, schema))
  for (const kind of KIND_ORDER) if (cats.get(kind)?.length) mkdirSync(join(CAP_ROOT, schema, kind))
}

// ---------------------------------------------------------------------------------------------
// Step 3 — capture (psql call #2): one generated script, one session, ON_ERROR_STOP=1

const OVERVIEW_FILES: [string, string][] = [
  ['schemas.txt', '\\dn+'],
  ['extensions.txt', '\\dx+'],
  ['roles.txt', '\\du+'],
  ['default-privileges.txt', '\\ddp'],
]

const cap: string[] = []
for (const [file, cmd] of OVERVIEW_FILES) cap.push(`\\o _overview/${file}`, cmd)
for (const [schema, cats] of bySchema) {
  cap.push(`\\o ${schema}/grants.txt`, `\\dp ${schema}.*`)
  for (const kind of KIND_ORDER) {
    const items = cats.get(kind)
    if (!items?.length) continue
    // .sql outputs (functions/triggers) are bracketed tuples-only + unaligned → bare source.
    const bare = kind === 'functions' || kind === 'triggers'
    if (bare) cap.push('\\t on', '\\pset format unaligned')
    for (const item of items) cap.push(`\\o ${item.file}`, ...item.commands)
    if (bare) cap.push('\\t off', '\\pset format aligned')
  }
}
cap.push('\\o')

writeFileSync(join(scratch, 'capture.sql'), cap.join('\n') + '\n')
execSync(
  `docker run --rm -i --network fnb-network` +
    ` -v "${CAP_ROOT}:/out" -v "${scratch}:/work" -w /out postgres:18` +
    ` psql "${PG_URL}" --no-psqlrc -q -v ON_ERROR_STOP=1 -f /work/capture.sql`,
  { stdio: 'inherit' },
)

// Manifest — the ONLY timestamp anywhere in the output (keeps every other diff structural).
const generatedAt = new Date().toISOString()
const pgUrl = new URL(PG_URL)
const counts: [string, number][] = [
  ['schemas', inv.schemas.length],
  ['tables', allTables.length],
  ['views', inv.views.length],
  ['matviews', inv.matviews.length],
  ['sequences', inv.sequences.length],
  ['enums', inv.enums.length],
  ['types', inv.types.length],
  ['domains', inv.domains.length],
  ['functions', inv.functions.length],
  ['triggers', inv.triggers.length],
]
const countLine = counts
  .filter(([, n]) => n > 0)
  .map(([k, n]) => `${k}: ${n}`)
  .join('   ')
writeFileSync(
  join(CAP_ROOT, '_overview', 'manifest.txt'),
  `generated-at: ${generatedAt}\ndatabase: ${pgUrl.hostname}${pgUrl.pathname}\n${countLine}\n`,
)

// ---------------------------------------------------------------------------------------------
// Step 4 — rollup: db-structure.data.js (window.DB_STRUCTURE) for the file:// tree browser.
// Item `file` paths stay in the rollup as stable tree ids / hash-link targets even though the
// per-object files themselves are temp-only.

const read = (rel: string) => readFileSync(join(CAP_ROOT, rel), 'utf8')

const rollup = {
  generatedAt,
  overview: ['manifest.txt', ...OVERVIEW_FILES.map(([f]) => f)].map((name) => ({
    name,
    content: read(`_overview/${name}`),
  })),
  schemas: [...bySchema.entries()].map(([name, cats]) => ({
    name,
    grants: read(`${name}/grants.txt`),
    categories: KIND_ORDER.filter((kind) => cats.get(kind)?.length).map((kind) => ({
      kind,
      items: cats
        .get(kind)!
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name: n, file }) => ({ name: n, file, content: read(file) })),
    })),
  })),
}
writeFileSync(
  join(OUT_ROOT, 'db-structure.data.js'),
  `window.DB_STRUCTURE = ${JSON.stringify(rollup, null, 2)}\n`,
)
rmSync(scratch, { recursive: true, force: true })

console.log(`db-introspect complete → ${OUT_ROOT}`)
console.log(`  ${countLine}`)
