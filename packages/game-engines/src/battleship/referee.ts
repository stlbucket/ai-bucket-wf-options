// The battleship two-board wrapper — turns engine calls into the ordered actions list
// (.claude/specs/game-server/game-event.workflow.data.md §referee). One engine board per
// seat: seats["1"] is seat 1's OWN hidden fleet; a shot by seat 1 is applyMove on
// seats["2"]. A board reaching status 'won' means its OWNER lost. Turn order: one seat,
// round-robin ascending, skipping resigned (2 seats ⇒ strict alternation). Every applying
// action carries its own stateAfter/viewsAfter snapshot (the replay record).

import type { BattleshipPlayerView } from '@function-bucket/fnb-types'
import { applyMove, createInitialGameState, type Cell, type GameState } from './engine'
import { dehydrate, hydrate, type SerializedGameState } from './serialize'
import { computeViews } from './views'
import { selectMachineMove } from './select-move'
import type {
  AgentMoveContext,
  ContextPlayer,
  DbGameStatus,
  DbSeatOutcome,
  EngineContext,
  RefereeAction,
  RefereeResult,
} from '../referee-types'

export interface BattleshipStateBlob {
  gameType: 'battleship'
  boardSize: number
  seats: Record<string, SerializedGameState>
}

interface Working {
  boardSize: number
  seats: Record<string, GameState>
  views: Record<string, BattleshipPlayerView>
  players: ContextPlayer[] // local copy; resigned flags updated as resign events apply
  expecting: number[]
  status: DbGameStatus
  outcomes?: Record<string, DbSeatOutcome>
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

function dehydrateBlob(w: Working): BattleshipStateBlob {
  const seats: Record<string, SerializedGameState> = {}
  for (const [k, s] of Object.entries(w.seats)) seats[k] = dehydrate(s)
  return { gameType: 'battleship', boardSize: w.boardSize, seats }
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
  const other = Object.keys(w.seats)
    .map(Number)
    .filter((s) => s !== seat)
  return other[0]!
}

/**
 * Fires `cell` for `seat` at its opponent's board and updates the working state:
 * seats, views, expectation, and (on a win) status + per-seat outcomes.
 */
function applySeatMove(w: Working, seat: number, cell: Cell): void {
  const opp = opponentOf(w, seat)
  const applied = applyMove(w.seats[String(opp)]!, cell)
  w.seats[String(opp)] = applied.state
  w.views = computeViews(w.seats)
  if (applied.state.status === 'won') {
    // opponent's board is fully sunk ⇒ opponent lost, mover won
    w.status = 'complete'
    w.outcomes = { [String(seat)]: 'won', [String(opp)]: 'lost' }
    w.expecting = []
  } else {
    w.expecting = [nextSeatAfter(w.players, seat)]
  }
}

function legalMoves(view: BattleshipPlayerView): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = []
  for (let row = 0; row < view.boardSize; row++) {
    for (let col = 0; col < view.boardSize; col++) {
      if (view.opponent.board[row]![col] === 'unknown') out.push({ row, col })
    }
  }
  return out
}

function kindOf(players: ContextPlayer[], seat: number) {
  return players.find((p) => p.seat === seat)?.kind ?? 'human'
}

/**
 * Runs the machine loop: while the game expects exactly one MACHINE seat, algorithm seats
 * fire inline (a `machine` action each); an agent seat emits needsAgentMove + agentContext
 * and stops (one Anthropic call per execution — the parse-agent node completes it).
 */
function runMachineLoop(w: Working, actions: RefereeAction[], rand: () => number): Pick<RefereeResult, 'needsAgentMove' | 'agentContext'> {
  while (w.status === 'in_progress' && w.expecting.length === 1) {
    const seat = w.expecting[0]!
    const kind = kindOf(w.players, seat)
    if (kind === 'human') break
    if (kind === 'machine_agent') {
      const view = w.views[String(seat)]!
      return { needsAgentMove: true, agentContext: { seat, view, legalMoves: legalMoves(view) } }
    }
    // machine_algorithm — selects from ITS OWN redacted view only (fairness lock)
    const cell = selectMachineMove(w.views[String(seat)]!, rand)
    applySeatMove(w, seat, cell)
    actions.push({
      kind: 'machine',
      seat,
      eventType: 'move',
      eventData: cell,
      stateAfter: dehydrateBlob(w),
      viewsAfter: w.views,
    })
  }
  return { needsAgentMove: false }
}

function workingFromContext(ctx: EngineContext): Working | null {
  const blob = ctx.gameState as BattleshipStateBlob | null
  if (!blob || !blob.seats) return null
  const seats: Record<string, GameState> = {}
  for (const [k, s] of Object.entries(blob.seats)) seats[k] = hydrate(s)
  const w: Working = {
    boardSize: blob.boardSize,
    seats,
    views: computeViews(seats),
    players: ctx.players.map((p) => ({ ...p })),
    expecting: [...ctx.game.expectingSeats],
    status: ctx.game.status,
  }
  return w
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

export function refereeBattleship(ctx: EngineContext, op: 'setup' | 'event', rand: () => number = Math.random): RefereeResult {
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

    const boardSize = Number(ctx.gameType.defaultConfig?.['boardSize'] ?? 10)
    const seats: Record<string, GameState> = {
      '1': createInitialGameState(boardSize, undefined, rand),
      '2': createInitialGameState(boardSize, undefined, rand),
    }
    const w: Working = {
      boardSize,
      seats,
      views: computeViews(seats),
      players: ctx.players.map((p) => ({ ...p })),
      expecting: [1],
      status: 'in_progress',
    }
    const blob = dehydrateBlob(w)
    const actions: RefereeAction[] = [
      // eventData is a non-secret marker only — game.game_event is tenant-readable once
      // applied, so the full state (ship positions!) must NEVER land there. The real
      // replay/authoritative record is stateAfter/viewsAfter, written to the deny-all
      // game.game_event_state table (caught live in verification: a cross-seat RLS check
      // showed the full blob leaking via event_data before this fix).
      { kind: 'system', eventType: 'setup', eventData: { gameType: blob.gameType, boardSize: blob.boardSize }, stateAfter: blob, viewsAfter: w.views },
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
      // always accepted from a seated player: state/views unchanged, seat marked resigned
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
      actions.push({ kind: 'apply', eventId: ev.id, stateAfter: dehydrateBlob(w), viewsAfter: w.views })
      continue
    }

    // 'move'
    if (ev.seat == null || !w.expecting.includes(ev.seat)) {
      actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: 'not_expected' })
      continue
    }
    const data = ev.eventData as { row?: unknown; col?: unknown } | null
    const cell: Cell = { row: Number(data?.row), col: Number(data?.col) }
    try {
      applySeatMove(w, ev.seat, cell)
    } catch (e) {
      const reason =
        e instanceof RangeError ? 'out_of_bounds' : (e as Error).message === 'ALREADY_FIRED' ? 'already_fired' : 'illegal_move'
      actions.push({ kind: 'reject', eventId: ev.id, rejectionReason: reason })
      continue
    }
    actions.push({ kind: 'apply', eventId: ev.id, stateAfter: dehydrateBlob(w), viewsAfter: w.views })
  }

  const agent = runMachineLoop(w, actions, rand)
  return result(w, actions, agent, ctx.game.eventCount)
}

/**
 * Completes a needsAgentMove referee result with the agent's raw completion text: parses
 * {row,col}, validates it against the machine seat's view, FALLS BACK to the algorithm on
 * any invalid/illegal completion (games never wedge — locked decision), applies the move,
 * and returns the finished RefereeResult.
 */
export function completeBattleshipAgentMove(
  ctx: EngineContext,
  referee: RefereeResult,
  agentText: string,
  rand: () => number = Math.random,
): RefereeResult {
  if (!referee.needsAgentMove || !referee.agentContext) return referee
  const seat = referee.agentContext.seat

  // rebuild the working state from the last applying action's snapshot (or the context's)
  const lastState = [...referee.actions].reverse().find((a) => 'stateAfter' in a) as
    | { stateAfter: unknown }
    | undefined
  const blob = (lastState?.stateAfter ?? ctx.gameState) as BattleshipStateBlob
  const seats: Record<string, GameState> = {}
  for (const [k, s] of Object.entries(blob.seats)) seats[k] = hydrate(s)
  const w: Working = {
    boardSize: blob.boardSize,
    seats,
    views: computeViews(seats),
    players: ctx.players.map((p) => ({ ...p })),
    expecting: [seat],
    status: 'in_progress',
  }

  const view = w.views[String(seat)]!
  let cell: Cell | null = null
  const match = /\{[^{}]*\}/.exec(agentText ?? '')
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { row?: unknown; col?: unknown }
      const row = Number(parsed.row)
      const col = Number(parsed.col)
      if (
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= 0 &&
        col >= 0 &&
        row < view.boardSize &&
        col < view.boardSize &&
        view.opponent.board[row]![col] === 'unknown'
      ) {
        cell = { row, col }
      }
    } catch {
      cell = null
    }
  }

  let agentFallback = false
  if (!cell) {
    cell = selectMachineMove(view, rand)
    agentFallback = true
  }

  applySeatMove(w, seat, cell)
  const actions: RefereeAction[] = [
    ...referee.actions,
    { kind: 'machine', seat, eventType: 'move', eventData: cell, stateAfter: dehydrateBlob(w), viewsAfter: w.views },
  ]
  // continue any remaining ALGORITHM seats (a second agent seat would need another HTTP
  // call — one per execution; unreachable in 2-seat games). Same execution as the initial
  // referee() call, so the SAME expectedEventCount guard applies throughout.
  const agent = runMachineLoop(w, actions, rand)
  return {
    ...result(w, actions, { needsAgentMove: false }, referee.expectedEventCount),
    agentFallback,
    ...(agent.needsAgentMove ? { needsAgentMove: false } : {}),
  }
}
