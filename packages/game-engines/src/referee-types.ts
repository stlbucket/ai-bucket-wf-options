// The referee I/O contract — mirrors game_fn.engine_context (input) and
// game_fn.record_referee_result (output). Spec: .claude/specs/game-server/_shared.data.md.
// Values use the DB's lowercase vocabulary (this code runs against jsonb, not GraphQL).

import type { BattleshipPlayerView } from '@function-bucket/fnb-types'

export type DbPlayerKind = 'human' | 'machine_algorithm' | 'machine_agent'
export type DbGameStatus = 'lobby' | 'in_progress' | 'complete' | 'abandoned'
export type DbEventType = 'setup' | 'move' | 'resign'
export type DbSeatOutcome = 'won' | 'lost' | 'drew'

export interface ContextPlayer {
  seat: number
  kind: DbPlayerKind
  resigned: boolean
}

export interface PendingEvent {
  id: string
  eventType: DbEventType
  seat: number | null
  eventData: unknown
  createdAt: string
}

/** What game_fn.engine_context returns. */
export interface EngineContext {
  game: {
    id: string
    tenantId: string
    gameTypeId: string
    status: DbGameStatus
    seatCount: number
    expectingSeats: number[]
    eventCount: number
  }
  gameType: {
    id: string
    status: string
    minPlayerSeats: number
    maxPlayerSeats: number
    supportedPlayerKinds: DbPlayerKind[]
    defaultConfig: Record<string, unknown>
  }
  players: ContextPlayer[]
  gameState: unknown | null // latest applied snapshot (null before setup)
  playerViews: Record<string, unknown> | null
  pendingEvents: PendingEvent[] // oldest first; several seats may hold one
}

/** One entry of the ordered actions list consumed by game_fn.record_referee_result. */
export type RefereeAction =
  | { kind: 'system'; eventType: 'setup'; eventData: unknown; stateAfter: unknown; viewsAfter: unknown }
  | { kind: 'apply'; eventId: string; stateAfter: unknown; viewsAfter: unknown }
  | { kind: 'reject'; eventId: string; rejectionReason: string }
  | { kind: 'machine'; seat: number; eventType: 'move'; eventData: unknown; stateAfter: unknown; viewsAfter: unknown }

/** What the agent branch needs: the acting seat's REDACTED view only (fairness lock). */
export interface AgentMoveContext {
  seat: number
  view: BattleshipPlayerView
  legalMoves: Array<{ row: number; col: number }>
}

export interface RefereeResult {
  actions: RefereeAction[]
  expectingSeats: number[]
  gameStatus: DbGameStatus
  outcomes?: Record<string, DbSeatOutcome>
  abortReason?: string
  // Optimistic concurrency guard: the game.event_count the referee assumed when it
  // computed this result (from engine_context). record_referee_result re-reads event_count
  // under its advisory lock and discards the ENTIRE result as a stale noop if it has moved —
  // this is what actually closes the concurrent-duplicate-execution race (the per-event
  // "still pending" re-check on 'apply' actions alone is not enough: two racing executions
  // can each independently compute and insert their OWN system/machine event from a stale
  // read, corrupting the log, even though neither one re-applies the SAME player event).
  expectedEventCount: number
  // n8n branch plumbing (stripped by record_referee_result — unknown keys are ignored)
  needsAgentMove: boolean
  agentContext?: AgentMoveContext
  agentFallback?: boolean
}
