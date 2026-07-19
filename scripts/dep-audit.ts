import { readdirSync, readFileSync, statSync } from 'fs'
import { builtinModules } from 'module'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Workspace dependency integrity gate (global-rules R24 —
// .claude/specs/workspace-dependency-integrity-pattern.md → Enforcement).
// Walks apps/* + packages/*, extracts bare import specifiers from source, and diffs them against
// each package's declared dependencies. Exits non-zero on MISSING declarations only; the
// unused-declaration report is informational (config-consumed deps — modules:/extends:/CSS/
// optimizeDeps — are invisible to an import scanner and live on the allowlist below).

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE_EXTS = ['.ts', '.mts', '.js', '.mjs', '.vue']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.nuxt', '.output', 'generated', '.turbo'])

// Never gate on these specifier classes: node builtins and alias/virtual specifiers resolved by
// Nuxt/Nitro/TS config, not package manifests.
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
const isAliasSpecifier = (s: string) =>
  s.startsWith('#') || s.startsWith('~') || s.startsWith('@/') || s.startsWith('.') || s.startsWith('/')

// "Never flag" classes for the UNUSED report (spec → Remediation C → Never flag / never purge):
// consumed via nuxt.config modules:/extends:, CSS, optimizeDeps, peer contracts, or script tooling.
const UNUSED_ALLOW_EXACT = new Set([
  'nuxt',
  'nuxt-mapbox',
  'vue',
  'tailwindcss',
  '@vueuse/core',
  '@urql/vue',
  'mapbox-gl',
  'typescript',
  'eslint',
  'vue-tsc',
  'vite',
  'vitest',
  'vite-plugin-dts',
  'graphql',
  'dotenv',
])
const UNUSED_ALLOW_PREFIXES = [
  '@nuxt/',
  '@iconify-json/',
  '@graphql-codegen/',
  '@function-bucket/',
  '@types/', // resolved implicitly by tsc, never imported
]

// import … from 'x' · export … from 'x' · bare `import 'x'` (lookbehind rejects CSS @import) ·
// dynamic import('x') · require('x')
const SPECIFIER_RES = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /(?<!@)\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

function* walkSourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walkSourceFiles(join(dir, entry.name))
    } else if (SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
      yield join(dir, entry.name)
    }
  }
}

interface AuditResult {
  pkg: string
  missing: Map<string, string[]> // package name → files that import it
  unused: string[]
}

function auditPackage(pkgDir: string): AuditResult | null {
  let manifest: {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
  try {
    manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ])

  const used = new Map<string, Set<string>>() // package name → importing files
  for (const file of walkSourceFiles(pkgDir)) {
    const src = readFileSync(file, 'utf8')
    for (const re of SPECIFIER_RES) {
      for (const m of src.matchAll(re)) {
        const spec = m[1]!
        if (isAliasSpecifier(spec) || BUILTINS.has(spec)) continue
        const name = packageName(spec)
        if (name === manifest.name) continue
        if (!used.has(name)) used.set(name, new Set())
        used.get(name)!.add(file.slice(REPO_ROOT.length + 1))
      }
    }
  }

  const missing = new Map<string, string[]>()
  for (const [name, files] of used) {
    if (!declared.has(name)) missing.set(name, [...files].sort())
  }
  const unused = [...declared]
    .filter(
      (name) =>
        !used.has(name) &&
        !UNUSED_ALLOW_EXACT.has(name) &&
        !UNUSED_ALLOW_PREFIXES.some((p) => name.startsWith(p)),
    )
    .sort()

  return { pkg: pkgDir.slice(REPO_ROOT.length + 1), missing, unused }
}

// Catalog / specifier hygiene (spec → Version alignment — pnpm catalog; both hard-fail):
// a catalogued package declared with any non-`catalog:` specifier in dependencies/
// devDependencies, and any `latest` / bare `*` specifier outside peerDependencies.
function parseCatalogNames(): Set<string> {
  const names = new Set<string>()
  const lines = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8').split('\n')
  let inCatalog = false
  for (const line of lines) {
    if (/^catalog:/.test(line)) {
      inCatalog = true
      continue
    }
    if (inCatalog) {
      if (/^\S/.test(line)) break
      const m = line.match(/^  '?([^':]+)'?:/)
      if (m) names.add(m[1]!)
    }
  }
  return names
}

function specifierViolations(manifestDir: string): string[] {
  const errors: string[] = []
  let manifest: Record<string, Record<string, string> | undefined>
  try {
    manifest = JSON.parse(readFileSync(join(manifestDir, 'package.json'), 'utf8'))
  } catch {
    return errors
  }
  const rel = manifestDir === REPO_ROOT ? '.' : manifestDir.slice(REPO_ROOT.length + 1)
  for (const block of ['dependencies', 'devDependencies'] as const) {
    for (const [name, spec] of Object.entries(manifest[block] ?? {})) {
      if (CATALOG_NAMES.has(name) && spec !== 'catalog:')
        errors.push(`CATALOG  ${rel}: '${name}' is catalogued but declared '${spec}' in ${block}`)
      if (spec === 'latest' || spec === '*')
        errors.push(`FLOATING ${rel}: '${name}': '${spec}' in ${block} (banned outside peerDependencies)`)
    }
  }
  return errors
}

const CATALOG_NAMES = parseCatalogNames()

const results: AuditResult[] = []
const specifierErrors: string[] = [...specifierViolations(REPO_ROOT)]
for (const group of ['apps', 'packages']) {
  const groupDir = join(REPO_ROOT, group)
  for (const entry of readdirSync(groupDir).sort()) {
    const pkgDir = join(groupDir, entry)
    if (!statSync(pkgDir).isDirectory()) continue
    const result = auditPackage(pkgDir)
    if (result) results.push(result)
    specifierErrors.push(...specifierViolations(pkgDir))
  }
}

let missingCount = 0
for (const { pkg, missing } of results) {
  for (const [name, files] of missing) {
    missingCount++
    console.error(`MISSING  ${pkg}: '${name}' imported but not declared`)
    for (const f of files) console.error(`           ${f}`)
  }
}

const withUnused = results.filter((r) => r.unused.length > 0)
if (withUnused.length > 0) {
  console.log('\nUnused declarations (informational — verify config/CSS usage before purging):')
  for (const { pkg, unused } of withUnused) console.log(`  ${pkg}: ${unused.join(', ')}`)
}

for (const err of specifierErrors) console.error(err)

if (missingCount > 0 || specifierErrors.length > 0) {
  if (missingCount > 0)
    console.error(`\ndep-audit: ${missingCount} missing declaration(s) (global-rules R24).`)
  if (specifierErrors.length > 0)
    console.error(
      `dep-audit: ${specifierErrors.length} catalog/floating-specifier violation(s) (global-rules R24).`,
    )
  process.exit(1)
}
console.log('\ndep-audit: no missing declarations, no catalog/specifier violations.')
