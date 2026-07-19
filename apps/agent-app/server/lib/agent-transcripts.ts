import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Per-run JSONL transcript on the agent-transcripts volume — the step-level record that
// replaces the retired wf uow DAG (every SDK message: model turns, tool calls, tool results).
// Read via: docker exec fnb_agent_app cat /data/transcripts/<runId>.jsonl
const TRANSCRIPTS_DIR = process.env.AGENT_TRANSCRIPTS_DIR ?? '/data/transcripts'

let dirEnsured = false

export async function appendTranscript(runId: string, message: unknown): Promise<void> {
  try {
    if (!dirEnsured) {
      await mkdir(TRANSCRIPTS_DIR, { recursive: true })
      dirEnsured = true
    }
    await appendFile(join(TRANSCRIPTS_DIR, `${runId}.jsonl`), `${JSON.stringify(message)}\n`)
  } catch (err) {
    // transcripts are observability, never run-fatal
    console.error(`[agent-transcripts] append failed for ${runId}:`, err)
  }
}
