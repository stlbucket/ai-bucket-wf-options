import { EventEmitter } from 'node:events'

// In-process wait/resume analog of the retired pull_trigger (exerciser.workflow.data.md):
// an EventEmitter waiter keyed by runId, resolved by POST /api/trigger/exerciser/resume/<runId>.
// Accepted limitation: the wait does NOT survive an agent-app restart — the durable upgrade
// path is SDK session resume (spec README → Open Questions).
const emitter = new EventEmitter()

export function awaitOperatorTrigger(runId: string, timeoutMs: number): Promise<Date> {
  return new Promise((resolve, reject) => {
    const onFire = () => {
      clearTimeout(timer)
      resolve(new Date())
    }
    const timer = setTimeout(() => {
      emitter.removeListener(runId, onFire)
      reject(new Error(`operator trigger wait timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    emitter.once(runId, onFire)
  })
}

export function fireOperatorTrigger(runId: string): boolean {
  return emitter.emit(runId)
}
