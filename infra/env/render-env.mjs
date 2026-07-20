#!/usr/bin/env node
// render-env.mjs — render infra/env/.env.prod.tpl to the box `.env` (spec terraform-and-cicd.md §3).
//
// Substitutes every ${NAME} token from the deploy environment (Terraform outputs + secret store,
// exported into this process's env by the pipeline) and FAILS LOUD if any required key is missing
// or empty — the dev `${VAR:?}` contract moved to render time. The rendered file is written
// root-only (chmod 600) and is never committed.
//
// Usage:  node render-env.mjs [templatePath] [outputPath]
//   defaults: template = <this dir>/.env.prod.tpl, output = ./.env
// Feed values in via env, e.g.  DOMAIN=example.com REGISTRY=... IMAGE_TAG=... node render-env.mjs

import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const templatePath = process.argv[2] ?? resolve(here, '.env.prod.tpl')
const outputPath = process.argv[3] ?? resolve(process.cwd(), '.env')

const template = readFileSync(templatePath, 'utf8')

const TOKEN = /\$\{([A-Z0-9_]+)\}/g

// Collect required tokens from NON-comment lines only — a ${...} inside a `#` comment is prose, not
// a key to satisfy. Comment tokens are left intact during substitution below.
const referenced = new Set()
for (const line of template.split('\n')) {
  if (/^\s*#/.test(line)) continue
  for (const m of line.matchAll(TOKEN)) referenced.add(m[1])
}
const required = [...referenced]

const missing = required.filter((name) => {
  const v = process.env[name]
  return v === undefined || v === ''
})

if (missing.length) {
  console.error(
    `render-env: ${missing.length} required value(s) missing from the environment:\n` +
      missing.map((n) => `  - ${n}`).join('\n') +
      `\nSupply them from the secret store + Terraform outputs before rendering.`,
  )
  process.exit(1)
}

// Substitute only the required (non-comment) tokens; any ${...} in a comment stays verbatim.
const rendered = template.replace(TOKEN, (match, name) =>
  referenced.has(name) ? process.env[name] : match,
)

writeFileSync(outputPath, rendered, { mode: 0o600 })
chmodSync(outputPath, 0o600) // enforce even if the file pre-existed with looser perms
console.log(`render-env: wrote ${outputPath} (${required.length} keys substituted, chmod 600)`)
