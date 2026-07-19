import { spawn } from 'node:child_process'

// clamdscan child-process wrapper (asset-scan.workflow.data.md): streams a /tmp file to the
// clamav service via the baked-in remote config (apps/agent-app/clamd-remote.conf). Runs INSIDE
// the scan_and_resolve tool handler only — the model has no execute tool.
//
// clamdscan exit codes: 0 = clean, 1 = infected (signature on stdout: "<path>: <sig> FOUND"),
// 2 = error (clamd unreachable / not yet warmed up / read failure).

export interface ClamVerdict {
  verdict: 'clean' | 'infected' | 'error'
  signature: string | null
  detail: string | null
}

export function clamdscanFile(path: string): Promise<ClamVerdict> {
  return new Promise((resolve, reject) => {
    const proc = spawn('clamdscan', [
      '--config-file=/etc/clamav/clamd-remote.conf',
      '--stream',
      '--no-summary',
      path
    ])
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    proc.on('error', (err) => reject(err)) // spawn failure — treated as transient by the caller
    proc.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8').trim()
      const err = Buffer.concat(stderr).toString('utf8').trim()
      if (code === 0) {
        resolve({ verdict: 'clean', signature: null, detail: null })
      } else if (code === 1) {
        const match = out.match(/:\s*(.+)\s+FOUND/)
        resolve({ verdict: 'infected', signature: match?.[1] ?? 'unknown', detail: null })
      } else {
        resolve({ verdict: 'error', signature: null, detail: err || out || `clamdscan exited ${code}` })
      }
    })
  })
}
