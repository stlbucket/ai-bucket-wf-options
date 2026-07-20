import { describe, expect, it } from 'vitest'
import type { BattleshipPlayerView } from '@function-bucket/fnb-types'
import { completeAgentMove, runReferee } from '@/referee'
import type { BattleshipStateBlob } from '@/battleship/referee'
import type { EngineContext, PendingEvent, RefereeResult } from '@/referee-types'
import { seededRand } from './engine.spec'

function ctxBase(over: Partial<EngineContext> = {}): EngineContext {
  return {
    game: {
      id: 'g1',
      tenantId: 't1',
      gameTypeId: 'battleship',
      status: 'lobby',
      seatCount: 2,
      expectingSeats: [],
      eventCount: 0,
      ...(over.game ?? {}),
    },
    gameType: {
      id: 'battleship',
      status: 'live',
      minPlayerSeats: 2,
      maxPlayerSeats: 2,
      supportedPlayerKinds: ['human', 'machine_algorithm', 'machine_agent'],
      defaultConfig: { boardSize: 10 },
      ...(over.gameType ?? {}),
    },
    players: over.players ?? [
      { seat: 1, kind: 'human', resigned: false },
      { seat: 2, kind: 'human', resigned: false },
    ],
    gameState: over.gameState ?? null,
    playerViews: over.playerViews ?? null,
    pendingEvents: over.pendingEvents ?? [],
  }
}

function setupGame(players?: EngineContext['players']): { ctx: EngineContext; setup: RefereeResult } {
  const ctx = ctxBase({ players })
  const setup = runReferee(ctx, 'setup', seededRand(11))
  const first = setup.actions[0] as { stateAfter: unknown; viewsAfter: unknown }
  const inProgress = ctxBase({
    players,
    game: { ...ctx.game, status: 'in_progress', expectingSeats: setup.expectingSeats, eventCount: 1 },
    gameState: first.stateAfter,
    playerViews: first.viewsAfter as Record<string, unknown>,
  })
  return { ctx: inProgress, setup }
}

function pendingMove(seat: number, row: number, col: number, id = `ev-${seat}-${row}-${col}`): PendingEvent {
  return { id, eventType: 'move', seat, eventData: { row, col }, createdAt: new Date().toISOString() }
}

/** an 'unknown' cell of the seat's view that is NOT a ship cell — guaranteed miss */
function missCellFor(blob: BattleshipStateBlob, seat: number): { row: number; col: number } {
  const opp = seat === 1 ? '2' : '1'
  const shipCells = new Set(blob.seats[opp]!.ships.flatMap((s) => s.cells))
  for (let r = 0; r < blob.boardSize; r++) {
    for (let c = 0; c < blob.boardSize; c++) {
      if (!shipCells.has(`${r},${c}`) && !blob.seats[opp]!.shots.includes(`${r},${c}`)) return { row: r, col: c }
    }
  }
  throw new Error('no miss cell')
}

describe('setup', () => {
  it('initializes: one system setup action, secret-free eventData, full state only in stateAfter', () => {
    const ctx = ctxBase()
    const res = runReferee(ctx, 'setup', seededRand(1))
    expect(res.actions).toHaveLength(1)
    const action = res.actions[0]! as { kind: string; eventData: unknown; stateAfter: BattleshipStateBlob }
    expect(action.kind).toBe('system')
    // eventData must be a NON-SECRET marker only — game.game_event is tenant-readable once
    // applied, so the generated fleet layout must never land there (caught live in
    // verification: a cross-seat RLS check showed both fleets leaking via event_data before
    // this was locked down). The full state belongs ONLY in stateAfter (deny-all snapshot).
    expect(action.eventData).toEqual({ gameType: 'battleship', boardSize: 10 })
    const blob = action.stateAfter
    expect(blob.gameType).toBe('battleship')
    expect(Object.keys(blob.seats).sort()).toEqual(['1', '2'])
    expect(res.expectingSeats).toEqual([1])
    expect(res.gameStatus).toBe('in_progress')
    expect(res.needsAgentMove).toBe(false)
  })

  it('noops when the game is not in lobby', () => {
    const { ctx } = setupGame()
    const res = runReferee(ctx, 'setup')
    expect(res.actions).toHaveLength(0)
    expect(res.gameStatus).toBe('in_progress')
  })

  it('aborts an illegal roster', () => {
    const ctx = ctxBase({
      players: [
        { seat: 1, kind: 'human', resigned: false },
        { seat: 2, kind: 'human', resigned: false },
        { seat: 3, kind: 'human', resigned: false },
      ],
    })
    const res = runReferee(ctx, 'setup')
    expect(res.gameStatus).toBe('abandoned')
    expect(res.abortReason).toBe('illegal_roster')
    expect(res.actions).toHaveLength(0)
  })
})

describe('moves', () => {
  it('applies an expected move and alternates the expectation', () => {
    const { ctx } = setupGame()
    const blob = ctx.gameState as BattleshipStateBlob
    const res = runReferee({ ...ctx, pendingEvents: [pendingMove(1, missCellFor(blob, 1).row, missCellFor(blob, 1).col)] }, 'event')
    expect(res.actions).toHaveLength(1)
    expect(res.actions[0]!.kind).toBe('apply')
    expect(res.expectingSeats).toEqual([2])
    expect(res.gameStatus).toBe('in_progress')
  })

  it('rejects an unexpected seat without advancing the turn', () => {
    const { ctx } = setupGame()
    const res = runReferee({ ...ctx, pendingEvents: [pendingMove(2, 0, 0)] }, 'event')
    expect(res.actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'not_expected' })
    expect(res.expectingSeats).toEqual([1])
  })

  it('rejects out-of-bounds and repeated shots with mapped reasons', () => {
    const { ctx } = setupGame()
    const oob = runReferee({ ...ctx, pendingEvents: [pendingMove(1, 99, 0)] }, 'event')
    expect(oob.actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'out_of_bounds' })

    const blob = ctx.gameState as BattleshipStateBlob
    const cell = missCellFor(blob, 1)
    const first = runReferee({ ...ctx, pendingEvents: [pendingMove(1, cell.row, cell.col)] }, 'event')
    const after = first.actions[0] as { stateAfter: unknown; viewsAfter: unknown }
    const ctx2: EngineContext = {
      ...ctx,
      game: { ...ctx.game, expectingSeats: [2], eventCount: 2 },
      gameState: after.stateAfter,
      playerViews: after.viewsAfter as Record<string, unknown>,
      // seat 2 fires at the SAME cell on seat 1's board? No — repeat means the same
      // attacker fires twice; walk the turn back to seat 1 by having seat 2 miss first.
      pendingEvents: [],
    }
    const blob2 = ctx2.gameState as BattleshipStateBlob
    const miss2 = missCellFor(blob2, 2)
    const second = runReferee({ ...ctx2, pendingEvents: [pendingMove(2, miss2.row, miss2.col)] }, 'event')
    const after2 = second.actions[0] as { stateAfter: unknown; viewsAfter: unknown }
    const repeat = runReferee(
      {
        ...ctx2,
        game: { ...ctx2.game, expectingSeats: [1], eventCount: 3 },
        gameState: after2.stateAfter,
        playerViews: after2.viewsAfter as Record<string, unknown>,
        pendingEvents: [pendingMove(1, cell.row, cell.col, 'ev-repeat')],
      },
      'event',
    )
    expect(repeat.actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'already_fired' })
    expect(repeat.expectingSeats).toEqual([1])
  })

  it('detects the win and emits per-seat outcomes', () => {
    const { ctx } = setupGame()
    let state = ctx.gameState as BattleshipStateBlob
    let expecting = [1]
    let views = ctx.playerViews
    let eventCount = 1
    let status: EngineContext['game']['status'] = 'in_progress'
    let lastResult: RefereeResult | null = null

    // seat 1 shoots every cell of seat 2's fleet; seat 2 misses in between
    const targetCells = state.seats['2']!.ships.flatMap((s) => s.cells)
    for (const cellStr of targetCells) {
      const [row, col] = cellStr.split(',').map(Number)
      const r1 = runReferee(
        {
          ...ctx,
          game: { ...ctx.game, status, expectingSeats: expecting, eventCount },
          gameState: state,
          playerViews: views,
          pendingEvents: [pendingMove(1, row!, col!, `s1-${cellStr}`)],
        },
        'event',
      )
      lastResult = r1
      const applied = r1.actions[0] as { kind: string; stateAfter: BattleshipStateBlob; viewsAfter: Record<string, unknown> }
      expect(applied.kind).toBe('apply')
      state = applied.stateAfter
      views = applied.viewsAfter
      eventCount++
      status = r1.gameStatus === 'complete' ? 'complete' : 'in_progress'
      expecting = r1.expectingSeats
      if (r1.gameStatus === 'complete') break
      // seat 2 replies with a guaranteed miss
      const miss = missCellFor(state, 2)
      const r2 = runReferee(
        {
          ...ctx,
          game: { ...ctx.game, status, expectingSeats: expecting, eventCount },
          gameState: state,
          playerViews: views,
          pendingEvents: [pendingMove(2, miss.row, miss.col, `s2-${miss.row}-${miss.col}`)],
        },
        'event',
      )
      const applied2 = r2.actions[0] as { stateAfter: BattleshipStateBlob; viewsAfter: Record<string, unknown> }
      state = applied2.stateAfter
      views = applied2.viewsAfter
      eventCount++
      expecting = r2.expectingSeats
    }

    expect(lastResult!.gameStatus).toBe('complete')
    expect(lastResult!.outcomes).toEqual({ '1': 'won', '2': 'lost' })
    expect(lastResult!.expectingSeats).toEqual([])
  })
})

describe('resign', () => {
  it('applies as an event and completes with per-seat outcomes', () => {
    const { ctx } = setupGame()
    const res = runReferee(
      {
        ...ctx,
        pendingEvents: [{ id: 'resign-1', eventType: 'resign', seat: 2, eventData: {}, createdAt: new Date().toISOString() }],
      },
      'event',
    )
    expect(res.actions[0]!.kind).toBe('apply')
    expect(res.gameStatus).toBe('complete')
    expect(res.outcomes).toEqual({ '2': 'lost', '1': 'won' })
    expect(res.expectingSeats).toEqual([])
  })
})

describe('machine seats', () => {
  const machinePlayers: EngineContext['players'] = [
    { seat: 1, kind: 'human', resigned: false },
    { seat: 2, kind: 'machine_algorithm', resigned: false },
  ]

  it('algorithm seat replies inline within the same result', () => {
    const { ctx } = setupGame(machinePlayers)
    const blob = ctx.gameState as BattleshipStateBlob
    const miss = missCellFor(blob, 1)
    const res = runReferee({ ...ctx, pendingEvents: [pendingMove(1, miss.row, miss.col)] }, 'event', seededRand(5))
    expect(res.actions.map((a) => a.kind)).toEqual(['apply', 'machine'])
    expect(res.expectingSeats).toEqual([1])
    expect(res.needsAgentMove).toBe(false)
  })

  it('agent seat emits needsAgentMove + a REDACTED agentContext and stops', () => {
    const agentPlayers: EngineContext['players'] = [
      { seat: 1, kind: 'human', resigned: false },
      { seat: 2, kind: 'machine_agent', resigned: false },
    ]
    const { ctx } = setupGame(agentPlayers)
    const blob = ctx.gameState as BattleshipStateBlob
    const miss = missCellFor(blob, 1)
    const res = runReferee({ ...ctx, pendingEvents: [pendingMove(1, miss.row, miss.col)] }, 'event')
    expect(res.needsAgentMove).toBe(true)
    expect(res.agentContext!.seat).toBe(2)
    expect(res.agentContext!.legalMoves.length).toBeGreaterThan(0)
    // fairness: the agent context must not leak the human fleet
    const json = JSON.stringify(res.agentContext)
    expect(json).not.toContain('"ships"')
    const view = res.agentContext!.view
    expect(view.opponent.board.flat().every((c) => ['unknown', 'hit', 'miss', 'sunk'].includes(c))).toBe(true)

    // completing with a legal agent move applies it
    const cell = res.agentContext!.legalMoves[0]!
    const done = completeAgentMove(ctx, res, `{"row": ${cell.row}, "col": ${cell.col}}`)
    expect(done.actions.map((a) => a.kind)).toEqual(['apply', 'machine'])
    expect(done.needsAgentMove).toBe(false)
    expect(done.agentFallback).toBe(false)

    // garbage completion falls back to the algorithm
    const fallback = completeAgentMove(ctx, res, 'I think I will pass, thanks!')
    expect(fallback.actions.map((a) => a.kind)).toEqual(['apply', 'machine'])
    expect(fallback.agentFallback).toBe(true)
  })
})

describe('redaction (views)', () => {
  it("never exposes unhit ships in the opponent's board", () => {
    const { ctx } = setupGame()
    const views = ctx.playerViews as Record<string, BattleshipPlayerView>
    for (const seat of ['1', '2']) {
      const flat = views[seat]!.opponent.board.flat()
      expect(flat.every((c) => c === 'unknown')).toBe(true) // no shots yet ⇒ everything unknown
      expect(views[seat]!.you.board.flat().filter((c) => c === 'ship')).toHaveLength(17)
    }
  })
})
