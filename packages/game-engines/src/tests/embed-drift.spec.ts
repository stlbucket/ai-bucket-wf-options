// Cheap drift alarm (infrastructure.md §1): the jsCode embedded in the game-event workflow
// must contain the current library bundle. Skips before Phase 3 exports the workflow file.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const workflowPath = resolve(__dirname, '../../../../n8n/workflows/game-event.json')

describe('embed drift', () => {
  it.skipIf(!existsSync(workflowPath))('workflow jsCode embeds the current bundle', () => {
    // Re-run the embed against a copy? Simpler: assert the bundle marker + glue are present
    // and that re-running `pnpm embed` produces no diff is left to the operator; here we
    // verify both Code nodes carry a GameEngines bundle at all.
    const workflow = JSON.parse(readFileSync(workflowPath, 'utf8')) as {
      nodes?: Array<{ name: string; parameters?: { jsCode?: string } }>
    }
    for (const name of ['referee', 'parse-agent-move']) {
      const node = (workflow.nodes ?? []).find((n) => n.name === name)
      expect(node, `node ${name} missing`).toBeTruthy()
      expect(node!.parameters?.jsCode ?? '').toContain('GameEngines')
    }
    // full byte-equality check: run the embed script against a temp copy and diff
    const embedded = execFileSync(process.execPath, [resolve(__dirname, '../../scripts/embed-check.mjs')], {
      encoding: 'utf8',
    }).trim()
    expect(embedded).toBe('in-sync')
  })
})
