import { describe, expect, it } from 'vitest'
import type { CheckersCell } from '@function-bucket/fnb-types'
import { completeAgentMove, runReferee } from '@/referee'
import { CHECKERS_AGENT_SYSTEM } from '@/checkers/referee'
import type { CheckersStateBlob } from '@/checkers/serialize'
import type { EngineContext, PendingEvent, RefereeResult } from '@/referee-types'
import { seededRand } from './engine.spec'

function ctxBase(over: Partial<EngineContext> = {}): EngineContext {
  return {
    game: {
      id: 'g1',
      tenantId: 't1',
      gameTypeId: 'checkers',
      status: 'lobby',
      seatCount: 2,
      expectingSeats: [],
      eventCount: 0,
      ...(over.game ?? {}),
    },
    gameType: {
      id: 'checkers',
      status: 'live',
      minPlayerSeats: 2,
      maxPlayerSeats: 2,
      supportedPlayerKinds: ['human', 'machine_algorithm', 'machine_agent'],
      defaultConfig: { boardSize: 8 },
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

function emptyBoard(size = 8): CheckersCell[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null as CheckersCell))
}
function put(board: CheckersCell[][], row: number, col: number, seat: number, king = false): void {
  board[row]![col] = { seat, king }
}
function blob(board: CheckersCell[][], moveCount = 1): CheckersStateBlob {
  return { gameType: 'checkers', boardSize: board.length, board, moveCount }
}
function inProgress(board: CheckersCell[][], over: Partial<EngineContext> = {}): EngineContext {
  return ctxBase({
    game: { id: 'g1', tenantId: 't1', gameTypeId: 'checkers', status: 'in_progress', seatCount: 2, expectingSeats: [1], eventCount: 1 },
    gameState: blob(board),
    ...over,
  })
}
function move(seat: number, from: { row: number; col: number }, path: Array<{ row: number; col: number }>, id = `ev-${seat}`): PendingEvent {
  return { id, eventType: 'move', seat, eventData: { from, path }, createdAt: new Date().toISOString() }
}

describe('setup', () => {
  it('emits one system setup action with a non-secret marker + full board in stateAfter', () => {
    const res = runReferee(ctxBase(), 'setup', seededRand(1))
    expect(res.actions).toHaveLength(1)
    const a = res.actions[0]! as { kind: string; eventData: unknown; stateAfter: CheckersStateBlob }
    expect(a.kind).toBe('system')
    expect(a.eventData).toEqual({ gameType: 'checkers', boardSize: 8 })
    expect(a.stateAfter.gameType).toBe('checkers')
    expect(a.stateAfter.board).toHaveLength(8)
    expect(res.expectingSeats).toEqual([1])
    expect(res.gameStatus).toBe('in_progress')
    expect(res.needsAgentMove).toBe(false)
  })

  it('abandons an illegal roster (defense-in-depth)', () => {
    const res = runReferee(ctxBase({ players: [{ seat: 1, kind: 'human', resigned: false }] }), 'setup', seededRand(1))
    expect(res.gameStatus).toBe('abandoned')
    expect(res.abortReason).toBe('illegal_roster')
  })

  it('noops when not in lobby', () => {
    expect(runReferee(inProgress(emptyBoard()), 'setup').actions).toHaveLength(0)
  })
})

describe('move validation', () => {
  it('applies a legal slide and flips the expectation to the opponent', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 0, 1, 2) // a distant seat 2 piece so the game continues (no forced capture, still mobile)
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 5, col: 2 }, [{ row: 4, col: 3 }])] })
    const res = runReferee(ctx, 'event')
    expect(res.actions[0]!.kind).toBe('apply')
    expect(res.expectingSeats).toEqual([2])
  })

  it('rejects a move from a seat that is not expected', () => {
    const b = emptyBoard()
    put(b, 2, 3, 2)
    const ctx = inProgress(b, { pendingEvents: [move(2, { row: 2, col: 3 }, [{ row: 3, col: 4 }])] })
    const res = runReferee(ctx, 'event')
    expect(res.actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'not_expected' })
  })

  it('rejects a structurally invalid move as illegal_move', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1)
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 5, col: 2 }, [{ row: 0, col: 0 }])] })
    expect(runReferee(ctx, 'event').actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'illegal_move' })
  })

  it('rejects a non-capturing slide when a capture is forced (not_a_legal_capture)', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1) // this man has a forced capture...
    put(b, 4, 3, 2)
    put(b, 5, 6, 1) // ...so this man's slide is illegal (must capture)
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 5, col: 6 }, [{ row: 4, col: 7 }])] })
    expect(runReferee(ctx, 'event').actions[0]).toMatchObject({ kind: 'reject', rejectionReason: 'not_a_legal_capture' })
  })

  it('applies the forced capture', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 4, 3, 2)
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 5, col: 2 }, [{ row: 3, col: 4 }])] })
    const res = runReferee(ctx, 'event')
    expect(res.actions[0]!.kind).toBe('apply')
  })
})

describe('outcomes', () => {
  it('wins by capturing the opponent to zero pieces', () => {
    const b = emptyBoard()
    put(b, 2, 3, 1)
    put(b, 1, 2, 2) // seat 2's only piece
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 2, col: 3 }, [{ row: 0, col: 1 }])] })
    const res = runReferee(ctx, 'event')
    expect(res.gameStatus).toBe('complete')
    expect(res.outcomes).toEqual({ '1': 'won', '2': 'lost' })
    expect(res.expectingSeats).toEqual([])
  })

  it('wins when the opponent has pieces but no legal move', () => {
    const b = emptyBoard()
    put(b, 2, 3, 1)
    put(b, 1, 2, 2) // captured this turn
    put(b, 7, 0, 2) // survives but is stuck at the far edge → no move
    const ctx = inProgress(b, { pendingEvents: [move(1, { row: 2, col: 3 }, [{ row: 0, col: 1 }])] })
    const res = runReferee(ctx, 'event')
    expect(res.gameStatus).toBe('complete')
    expect(res.outcomes).toEqual({ '1': 'won', '2': 'lost' })
  })

  it('resign ends a 2-seat game with per-seat outcomes', () => {
    const ctx = inProgress(emptyBoard(), {
      pendingEvents: [{ id: 'r1', eventType: 'resign', seat: 1, eventData: {}, createdAt: new Date().toISOString() }],
    })
    const res = runReferee(ctx, 'event')
    expect(res.gameStatus).toBe('complete')
    expect(res.outcomes).toEqual({ '1': 'lost', '2': 'won' })
  })
})

describe('machine seats', () => {
  it('an algorithm opponent replies inside the same execution', () => {
    const players: EngineContext['players'] = [
      { seat: 1, kind: 'human', resigned: false },
      { seat: 2, kind: 'machine_algorithm', resigned: false },
    ]
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 2, 3, 2) // seat 2 has a slide available after seat 1 moves
    const ctx = inProgress(b, { players, pendingEvents: [move(1, { row: 5, col: 2 }, [{ row: 4, col: 3 }])] })
    const res = runReferee(ctx, 'event', seededRand(5))
    const kinds = res.actions.map((a) => a.kind)
    expect(kinds).toContain('apply') // the human move
    expect(kinds).toContain('machine') // the algorithm reply
    expect(res.needsAgentMove).toBe(false)
    expect(res.expectingSeats).toEqual([1]) // back to the human
  })

  it('an agent opponent emits needsAgentMove + an engine-supplied system prompt, and completeAgentMove finishes it', () => {
    const players: EngineContext['players'] = [
      { seat: 1, kind: 'human', resigned: false },
      { seat: 2, kind: 'machine_agent', resigned: false },
    ]
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 2, 3, 2)
    const ctx = inProgress(b, { players, pendingEvents: [move(1, { row: 5, col: 2 }, [{ row: 4, col: 3 }])] })
    const referee = runReferee(ctx, 'event', seededRand(5))
    expect(referee.needsAgentMove).toBe(true)
    expect(referee.agentContext!.seat).toBe(2)
    expect(referee.agentContext!.system).toBe(CHECKERS_AGENT_SYSTEM)

    // valid completion picks the chosen legal move
    const done: RefereeResult = completeAgentMove(ctx, referee, '{"moveIndex": 0}', seededRand(5))
    expect(done.needsAgentMove).toBe(false)
    expect(done.actions.some((a) => a.kind === 'machine')).toBe(true)

    // garbage completion falls back to the algorithm (never wedges)
    const fb = completeAgentMove(ctx, referee, 'nonsense, no json', seededRand(5))
    expect(fb.agentFallback).toBe(true)
    expect(fb.actions.some((a) => a.kind === 'machine')).toBe(true)
  })
})
