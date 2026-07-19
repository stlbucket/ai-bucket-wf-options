import { execSync } from 'child_process'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_ROOT = join(REPO_ROOT, 'packages/db-types')
const GENERATED = join(PKG_ROOT, 'src/generated')
const MUTATIONS = join(PKG_ROOT, 'src/mutations')

// Step 1: Run kanel (unified single-pass generation into src/generated/)
console.log('==> Generating types from database...')
execSync('pnpm generate', { cwd: PKG_ROOT, stdio: 'inherit' })

// Build an index.ts barrel for a directory of generated type files.
// Kanel emits default exports for tables/enums/Schema interfaces, so re-export style matters:
//  - `*Schema` files  → `export type { default as X }`
//  - enum files       → `export { default as X }`
//  - everything else  → `export *` (named Selectable/Insertable/branded-id exports)
function buildTypeBarrel(absDir: string) {
  const files = readdirSync(absDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => f.replace(/\.ts$/, ''))
    .sort()

  const lines = files.map((file) => {
    const content = readFileSync(join(absDir, `${file}.ts`), 'utf-8')
    if (file.endsWith('Schema')) {
      return `export type { default as ${file} } from './${file}'`
    }
    if (/\benum\b/.test(content) && /export default/.test(content)) {
      return `export { default as ${file} } from './${file}'`
    }
    return `export * from './${file}'`
  })

  writeFileSync(join(absDir, 'index.ts'), lines.join('\n') + '\n')
}

// Step 2: Rebuild per-schema barrels + the top-level generated barrel (fully data-driven).
console.log('==> Rebuilding generated barrels...')
const schemaDirs = readdirSync(GENERATED, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

for (const schema of schemaDirs) {
  buildTypeBarrel(join(GENERATED, schema))
}

// Aggregate all schema barrels so src/index.ts can `export * from '@/generated'` and pick up
// new schemas automatically. (Database.ts sits at the generated root and is imported by db.ts.)
writeFileSync(
  join(GENERATED, 'index.ts'),
  schemaDirs.map((s) => `export * from './${s}/index'`).join('\n') + '\n',
)

// Step 3: Rebuild mutation barrels (data-driven — every dir that directly holds mutation files).
console.log('==> Rebuilding mutation indexes...')
function mutationLeafDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const hasTs = entries.some(
    (e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts',
  )
  const leaves = hasTs ? [dir] : []
  for (const e of entries) {
    if (e.isDirectory()) leaves.push(...mutationLeafDirs(join(dir, e.name)))
  }
  return leaves
}

for (const dir of mutationLeafDirs(MUTATIONS)) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => f.replace(/\.ts$/, ''))
    .sort()
  writeFileSync(join(dir, 'index.ts'), files.map((f) => `export * from './${f}'`).join('\n') + '\n')
}

// NOTE: src/index.ts is intentionally NOT regenerated here — it is hand-maintained.
// Mutation namespace aliases (appApi/appFn/authFn/msgApi) and query re-exports can't be safely
// derived from disk. New *generated schemas* flow in automatically via src/generated/index.ts;
// new queries or mutation namespaces must be wired into src/index.ts by hand.
console.log('==> Done. (src/index.ts is hand-maintained — wire new queries/mutations there.)')
