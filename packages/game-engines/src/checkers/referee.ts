// The checkers referee — turns engine calls into the platform's ordered actions list
// (.claude/specs/game-server/checkers/engine-workflow.data.md). One shared board; seats
// alternate (round-robin ascending, skipping resigned — 2 seats ⇒ strict alternation). One
// event = one COMPLETE move ({from, path}); the referee validates it against the enumerated
// legal moves and applies it atomically, then checks the opponent for a loss (0 pieces or no
// legal move) before flipping the expectation. Every applying action carries its own
// stateAfter/viewsAfter snapshot (the replay record).

import type { CheckersLegalMove, CheckersMove, CheckersPlayerView, CheckersSquare } from '@function-bucket/fnb-types'
import { applyMove, createInitialState, pieceCount, type CheckersState } from './engine'
import { hasAnyMove, legalMovesFor, sameMove } from './legal-moves'
import { dehydrate, hydrate, type CheckersStateBlob } from './serialize'
import { computeViews } from './views'
import { selectMachineMove } from './select-move'
import type {
  ContextPlayer,
  DbGameStatus,
  DbSeatOutcome,
  EngineContext,
  RefereeAction,
  RefereeResult,
} from '../referee-types'

// Engine-supplied agent system prompt — keeps the game-event workflow's anthropic-move node
// game-agnostic (it reads agentContext.system). The agent picks from the enumerated legalMoves
// by index, so parsing + validation + fallback are trivial and always safe.
export const CHECKERS_AGENT_SYSTEM =
  'You are playing Checkers (English draughts, 8x8). You will be given your view of the board and a numbered list `legalMoves` of every move you may legally make (captures are forced when present). Choose the strongest move. Respond with ONLY a JSON object {"moveIndex": <n>} where n is the 0-based index into legalMoves. No prose.'

interface Working {
  boardSize: number
  board: CheckersState['board']
  moveCount: number
  players: ContextPlayer[]
  expecting: number[]
  status: DbGameStatus
  outcomes?: Record<string, DbSeatOutcome>
  lastMove: CheckersMove | null
}

function stateOf(w: Working): CheckersState {
  return { boardSize: w.boardSize, board: w.board, moveCount: w.moveCount }
}

function snapshot(w: Working): { blob: CheckersStateBlob; views: Record<string, CheckersPlayerView> } {
  const toMove = w.expecting[0] ?? -1
  return { blob: dehydrate(stateOf(w)), views: computeViews(stateOf(w), toMove, w.lastMove) }
}

function noop(ctx: EngineContext): RefereeResult {
  return {
    actions: [],
    expectingSeats: ctx.game.expectingSeats,
    gameStatus: ctx.game.status,
    expectedEventCount: ctx.game.eventCount,
    needsAgentMove: false,
  }
}

function activeSeats(players: ContextPlayer[]): number[] {
  return players
    .filter((p) => !p.resigned)
    .map((p) => p.seat)
    .sort((a, b) => a - b)
}

/** Next expected seat after `seat`, round-robin ascending, skipping resigned seats. */
function nextSeatAfter(players: ContextPlayer[], seat: number): number {
  const active = activeSeats(players)
  const later = active.filter((s) => s > seat)
  return later.length ? later[0]! : active[0]!
}

function opponentOf(w: Working, seat: number): number {
  return activeSeats(w.players).find((s) => s !== seat) ?? w.players.map((p) => p.seat).find((s) => s !== seat)!
}

function kindOf(players: ContextPlayer[], seat: number) {
  return players.find((p) => p.seat === seat)?.kind ?? 'human'
}

function seatViewWithMoves(w: Working, seat: number): CheckersPlayerView {
  return computeViews(stateOf(w), seat, w.lastMove)[String(seat)]!
}

/** Applies an already-legal move; updates board, lastMove, and win/expectation. */
function applyLegalMove(w: Working, seat: number, move: CheckersLegalMove): void {
  const next = applyMove(stateOf(w), seat, move)
  w.board = next.board
  w.moveCount = next.moveCount
  w.lastMove = { seat, from: move.from, path: move.path, captured: move.captures }
  const opp = opponentOf(w, seat)
  if (pieceCount(next, opp) === 0 || !hasAnyMove(next, opp)) {
    w.status = 'complete'
    w.outcomes = { [String(seat)]: 'won', [String(opp)]: 'lost' }
    w.expecting = []
  } else {
    w.expecting = [nextSeatAfter(w.players, seat)]
  }
}

function parseSubmittedMove(eventData: unknown): { from: CheckersSquare; path: CheckersSquare[] } | null {
  const d = eventData as { from?: { row?: unknown; col?: unknown }; path?: unknown } | null
  if (!d || !d.from || !Array.isArray(d.path) || d.path.length === 0) return null
  const from = { row: Number(d.from.row), col: Number(d.from.col) }
  const path: CheckersSquare[] = []
  for (const step of d.path as Array<{ row?: unknown; col?: unknown }>) {
    if (!step) return null
    path.push({ row: Number(step.row), col: Number(step.col) })
  }
  if (![from, ...path].every((s) => Number.isInteger(s.row) && Number.isInteger(s.col))) return null
  return { from, path }
}

/** Validate a submitted move against the seat's legal moves and apply it, or return a reason. */
function applyMoveChecked(w: Working, seat: number, eventData: unknown): string | null {
  const submitted = parseSubmittedMove(eventData)
  if (!submitted) return 'illegal_move'
  const legal = legalMovesFor(stateOf(w), seat)
  const match = legal.find((m) => sameMove(submitted, m))
  if (!match) return legal.some((m) => m.captures.length > 0) ? 'not_a_legal_capture' : 'illegal_move'
  applyLegalMove(w, seat, match)
  return null
}

/**
 * Runs the machine loop: while the game expects exactly one MACHINE seat, algorithm seats move
 * inline (a `machine` action each); an agent seat emits needsAgentMove + agentContext (its own
 * view + legalMoves + the engine-supplied system prompt) and stops (one Anthropic call per
 * execution — the parse-agent node completes it).
 */
// Defensive cap. In production seat 1 is always human, so the loop runs at most one machine
// move per execution and this is never approached. But checkers has no draw rule yet (deferred
// — README Open Questions), so a both-machine config could otherwise shuffle kings forever and
// hang the referee; the cap turns that pathological case into a safe break (game left
// in_progress) instead of an infinite loop.
const MACHINE_LOOP_CAP = 500

function runMachineLoop(w: Working, actions: RefereeAction[], rand: () => number): Pick<RefereeResult, 'needsAgentMove' | 'agentContext'> {
  let iterations = 0
  while (w.status === 'in_progress' && w.expecting.length === 1) {
    if (iterations++ >= MACHINE_LOOP_CAP) break
    const seat = w.expecting[0]!
    const kind = kindOf(w.players, seat)
    if (kind === 'human') break
    const view = seatViewWithMoves(w, seat)
    if (kind === 'machine_agent') {
      return { needsAgentMove: true, agentContext: { seat, system: CHECKERS_AGENT_SYSTEM, view, legalMoves: view.legalMoves } }
    }
    // machine_algorithm — selects from ITS OWN view only (fairness lock)
    const move = selectMachineMove(view, rand)
    applyLegalMove(w, seat, move)
    const { blob, views } = snapshot(w)
    actions.push({ kind: 'machine', seat, eventType: 'move', eventData: { from: move.from, path: move.path }, stateAfter: blob, viewsAfter: views })
  }
  return { needsAgentMove: false }
}

function workingFromContext(ctx: EngineContext): Working | null {
  const blob = ctx.gameState as CheckersStateBlob | null
  if (!blob || !blob.board) return null
  const s = hydrate(blob)
  return {
    boardSize: s.boardSize,
    board: s.board,
    moveCount: s.moveCount,
    players: ctx.players.map((p) => ({ ...p })),
    expecting: [...ctx.game.expectingSeats],
    status: ctx.game.status,
    lastMove: null,
  }
}

function result(
  w: Working,
  actions: RefereeAction[],
  agent: Pick<RefereeResult, 'needsAgentMove' | 'agentContext'>,
  expectedEventCount: number,
): RefereeResult {
  return {
    actions,
    expectingSeats: w.expecting,
    gameStatus: w.status,
    expectedEventCount,
    ...(w.outcomes ? { outcomes: w.outcomes } : {}),
    ...agent,
  }
}

export function refereeCheckers(ctx: EngineContext, op: 'setup' | 'event', rand: () => number = Math.random): RefereeResult {
  if (op === 'setup') {
    if (ctx.game.status !== 'lobby') return noop(ctx)

    // defense-in-depth — game_fn.create_game already enforced the registry bounds/kinds
    const seatsOk =
      ctx.players.length === 2 &&
      [1, 2].every((s) => ctx.players.some((p) => p.seat === s)) &&
      ctx.players.every((p) => ctx.gameType.supportedPlayerKinds.includes(p.kind))
    if (!seatsOk) {
      return {
        actions: [],
        expectingSeats: [],
        gameStatus: 'abandoned',
        abortReason: 'illegal_roster',
        expectedEventCount: ctx.game.eventCount,
        needsAgentMove: false,
      }
    }

    const boardSize = Number(ctx.gameType.defaultConfig?.['boardSize'] ?? 8)
    const initial = createInitialState(boardSize)
    const w: Working = {
      boardSize,
      board: initial.board,
      moveCount: initial.moveCount,
      players: ctx.players.map((p) => ({ ...p })),
      expecting: [1],
      status: 'in_progress',
      lastMove: null,
    }
    const { blob, views } = snapshot(w)
    const actions: RefereeAction[] = [
      // eventData is a NON-SECRET marker only (uniform with battleship; checkers has no secret
      // anyway). The full board lives in stateAfter → the deny-all game_event_state table.
      { kind: 'system', eventType: 'setup', eventData: { gameType: 'checkers', boardSize }, stateAfter: blob, viewsAfter: views },
    ]
    const agent = runMachineLoop(w, actions, rand)
    return result(w, actions, agent, ctx.game.eventCount)
  }

  // op === 'event'
  if (ctx.game.status !== 'in_progress' || ctx.pendingEvents.length === 0) return noop(ctx)
  const w = workingFromContext(ctx)
  if (!w) return noop(ctx)

  const actions: RefereeAction[] = []

  for (const ev of ctx.pendingEvents) {
    if (w.status !== 'in_progress') {
      actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: 'game_not_in_progress' })
      continue
    }

    if (ev.eventType === 'resign') {
      const player = w.players.find((p) => p.seat === ev.seat)
      if (!player || player.resigned) {
        actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: 'not_active_seat' })
        continue
      }
      player.resigned = true
      const active = activeSeats(w.players)
      if (active.length === 1) {
        w.status = 'complete'
        w.outcomes = { [String(ev.seat)]: 'lost', [String(active[0]!)]: 'won' }
        w.expecting = []
      } else if (w.expecting.includes(ev.seat!)) {
        w.expecting = [nextSeatAfter(w.players, ev.seat!)]
      }
      const { blob, views } = snapshot(w)
      actions.push({ kind: 'apply', eventId: ev.id, stateAfter: blob, viewsAfter: views })
      continue
    }

    // 'move'
    if (ev.seat == null || !w.expecting.includes(ev.seat)) {
      actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: 'not_expected' })
      continue
    }
    const reason = applyMoveChecked(w, ev.seat, ev.eventData)
    if (reason) {
      actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: reason })
      continue
    }
    const { blob, views } = snapshot(w)
    actions.push({ kind: 'apply', eventId: ev.id, stateAfter: blob, viewsAfter: views })
  }

  const agent = runMachineLoop(w, actions, rand)
  return result(w, actions, agent, ctx.game.eventCount)
}

/**
 * Completes a needsAgentMove referee result with the agent's raw completion text: parses
 * {moveIndex}, validates it against the machine seat's legalMoves, FALLS BACK to the algorithm
 * on any invalid/illegal completion (games never wedge — locked decision), applies the move,
 * and returns the finished RefereeResult.
 */
export function completeCheckersAgentMove(
  ctx: EngineContext,
  referee: RefereeResult,
  agentText: string,
  rand: () => number = Math.random,
): RefereeResult {
  if (!referee.needsAgentMove || !referee.agentContext) return referee
  const seat = referee.agentContext.seat

  const lastState = [...referee.actions].reverse().find((a) => 'stateAfter' in a) as { stateAfter: unknown } | undefined
  const blob = (lastState?.stateAfter ?? ctx.gameState) as CheckersStateBlob
  const s = hydrate(blob)
  const w: Working = {
    boardSize: s.boardSize,
    board: s.board,
    moveCount: s.moveCount,
    players: ctx.players.map((p) => ({ ...p })),
    expecting: [seat],
    status: 'in_progress',
    lastMove: null,
  }

  const view = seatViewWithMoves(w, seat)
  let move: CheckersLegalMove | null = null
  const match = /\{[^{}]*\}/.exec(agentText ?? '')
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { moveIndex?: unknown }
      const i = Number(parsed.moveIndex)
      if (Number.isInteger(i) && i >= 0 && i < view.legalMoves.length) move = view.legalMoves[i]!
    } catch {
      move = null
    }
  }

  let agentFallback = false
  if (!move) {
    move = selectMachineMove(view, rand)
    agentFallback = true
  }

  applyLegalMove(w, seat, move)
  const { blob: after, views } = snapshot(w)
  const actions: RefereeAction[] = [
    ...referee.actions,
    { kind: 'machine', seat, eventType: 'move', eventData: { from: move.from, path: move.path }, stateAfter: after, viewsAfter: views },
  ]
  const agent = runMachineLoop(w, actions, rand)
  return {
    ...result(w, actions, { needsAgentMove: false }, referee.expectedEventCount),
    agentFallback,
    ...(agent.needsAgentMove ? { needsAgentMove: false } : {}),
  }
}
