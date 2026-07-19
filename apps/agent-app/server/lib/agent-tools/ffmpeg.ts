import { spawn } from 'node:child_process'

// ffmpeg wrapper — the agent-app image carries the ffmpeg system binary (apps/agent-app/
// Dockerfile). Reimplements the retired worker-app wrapper: spawn with pipes, no temp files;
// input bytes → stdin, webp ← stdout. Runs INSIDE the make_thumbnail tool handler only.
//
// Geometry (locked 2026-07-06): max dimension maxPx, aspect-preserving, NEVER enlarge, webp.
export function thumbnailWebp(input: Buffer, maxPx: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      '-vf',
      `scale='min(${maxPx},iw)':'min(${maxPx},ih)':force_original_aspect_ratio=decrease`,
      '-f',
      'webp',
      'pipe:1'
    ]

    const proc = spawn('ffmpeg', args)
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout))
      } else {
        const detail = Buffer.concat(stderr).toString('utf8').trim()
        reject(new Error(`ffmpeg exited ${code}: ${detail || 'no stderr'}`))
      }
    })

    proc.stdin.on('error', (err) => reject(err))
    proc.stdin.write(input)
    proc.stdin.end()
  })
}
