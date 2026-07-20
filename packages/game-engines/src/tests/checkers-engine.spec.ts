import { describe, expect, it } from 'vitest'
import type { CheckersCell, CheckersState } from '@function-bucket/fnb-types'
import { applyMove, createInitialState, isPlayable, pieceAt, pieceCount } from '@/checkers/engine'
import { hasAnyMove, legalMovesFor, sameMove } from '@/checkers/legal-moves'
import { computeViews } from '@/checkers/views'
import { selectMachineMove } from '@/checkers/select-move'
import { seededRand } from './engine.spec'

function emptyBoard(size = 8): CheckersCell[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null as CheckersCell))
}
function state(board: CheckersCell[][], moveCount = 0): CheckersState {
  return { boardSize: board.length, board, moveCount }
}
function put(board: CheckersCell[][], row: number, col: number, seat: number, king = false): void {
  board[row]![col] = { seat, king }
}

describe('createInitialState', () => {
  it('seats 12 men each on the dark squares of the three home rows', () => {
    const s = createInitialState(8)
    expect(pieceCount(s, 1)).toBe(12)
    expect(pieceCount(s, 2)).toBe(12)
    // every piece is on a playable (dark) square; seat 2 top, seat 1 bottom
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = s.board[r]![c]
        if (p) {
          expect(isPlayable(r, c)).toBe(true)
          expect(p.seat).toBe(r < 3 ? 2 : 1)
          expect(p.king).toBe(false)
        }
      }
  })
})

describe('legalMovesFor — slides', () => {
  it('opening position gives seat 1 exactly 7 forward slides', () => {
    const s = createInitialState(8)
    const moves = legalMovesFor(s, 1)
    expect(moves).toHaveLength(7)
    expect(moves.every((m) => m.captures.length === 0)).toBe(true)
    // all move to row 4 (one step up from row 5)
    expect(moves.every((m) => m.path[0]!.row === 4 && m.from.row === 5)).toBe(true)
  })

  it('men move forward only — a seat 1 man cannot slide toward its own back row', () => {
    const b = emptyBoard()
    put(b, 4, 3, 1)
    const moves = legalMovesFor(state(b), 1)
    // seat 1 forward is row-1; destinations are (3,2) and (3,4), never row 5
    expect(moves.map((m) => m.path[0]!.row)).toEqual([3, 3])
    expect(moves.some((m) => m.path[0]!.row === 5)).toBe(false)
  })

  it('a king moves one step in all four diagonals', () => {
    const b = emptyBoard()
    put(b, 4, 3, 1, true)
    const dests = legalMovesFor(state(b), 1)
      .map((m) => `${m.path[0]!.row},${m.path[0]!.col}`)
      .sort()
    expect(dests).toEqual(['3,2', '3,4', '5,2', '5,4'])
  })
})

describe('legalMovesFor — captures (forced)', () => {
  it('a single capture is returned and forces out all slides', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1) // seat 1 man
    put(b, 4, 3, 2) // enemy diagonally forward
    // (3,4) empty landing
    const moves = legalMovesFor(state(b), 1)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.captures).toEqual([{ row: 4, col: 3 }])
    expect(moves[0]!.path).toEqual([{ row: 3, col: 4 }])
  })

  it('enumerates a chained double jump as ONE move', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 4, 3, 2)
    put(b, 2, 3, 2)
    const moves = legalMovesFor(state(b), 1)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.path).toEqual([
      { row: 3, col: 4 },
      { row: 1, col: 2 },
    ])
    expect(moves[0]!.captures).toEqual([
      { row: 4, col: 3 },
      { row: 2, col: 3 },
    ])
  })

  it('kinging ends the turn — the chain stops on promotion even if a further jump exists', () => {
    const b = emptyBoard()
    put(b, 2, 5, 1) // seat 1 man
    put(b, 1, 4, 2) // jumped → land (0,3) = seat 1 king row
    put(b, 1, 2, 2) // a would-be continuation for a king from (0,3)
    const moves = legalMovesFor(state(b), 1)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.path).toEqual([{ row: 0, col: 3 }]) // stops at promotion, no second jump
    expect(moves[0]!.captures).toEqual([{ row: 1, col: 4 }])
  })
})

describe('applyMove', () => {
  it('slides a man and increments moveCount', () => {
    const s = createInitialState(8)
    const move = legalMovesFor(s, 1).find((m) => m.from.row === 5 && m.from.col === 2 && m.path[0]!.col === 3)!
    const next = applyMove(s, 1, move)
    expect(pieceAt(next.board, { row: 5, col: 2 })).toBeNull()
    expect(pieceAt(next.board, { row: 4, col: 3 })).toEqual({ seat: 1, king: false })
    expect(next.moveCount).toBe(1)
  })

  it('removes jumped pieces and crowns a man reaching the king row', () => {
    const b = emptyBoard()
    put(b, 2, 3, 1)
    put(b, 1, 2, 2)
    const move = legalMovesFor(state(b), 1)[0]! // jump (2,3)->(0,1) capturing (1,2)
    const next = applyMove(state(b), 1, move)
    expect(pieceAt(next.board, { row: 1, col: 2 })).toBeNull() // captured
    expect(pieceAt(next.board, { row: 0, col: 1 })).toEqual({ seat: 1, king: true }) // crowned
    expect(pieceCount(next, 2)).toBe(0)
  })
})

describe('hasAnyMove', () => {
  it('a lone man stuck at the far edge has no move', () => {
    const b = emptyBoard()
    put(b, 7, 0, 2) // seat 2 man at the bottom edge; forward (dr+1) is off-board
    expect(hasAnyMove(state(b), 2)).toBe(false)
  })
})

describe('computeViews — identity redaction', () => {
  it('both seats see the same full board; legalMoves only for the seat to move', () => {
    const s = createInitialState(8)
    const views = computeViews(s, 1, null)
    expect(views['1']!.board).toEqual(views['2']!.board) // nothing hidden
    expect(views['1']!.board).toEqual(s.board)
    expect(views['1']!.legalMoves.length).toBe(7)
    expect(views['2']!.legalMoves.length).toBe(0)
    expect(views['1']!.yourSeat).toBe(1)
    expect(views['2']!.yourSeat).toBe(2)
  })

  it('does not mutate the state board', () => {
    const s = createInitialState(8)
    const before = JSON.stringify(s.board)
    computeViews(s, 1, null)
    expect(JSON.stringify(s.board)).toBe(before)
  })
})

describe('selectMachineMove', () => {
  it('never returns an illegal move and prefers the longest capture', () => {
    const b = emptyBoard()
    put(b, 5, 2, 1)
    put(b, 4, 3, 2)
    put(b, 2, 3, 2) // enables a double jump
    put(b, 5, 6, 1) // an unrelated piece with only a single capture available? none here
    const view = computeViews(state(b), 1, null)['1']!
    const move = selectMachineMove(view, seededRand(3))
    expect(view.legalMoves.some((m) => sameMove(move, m))).toBe(true)
    // the double jump (2 captures) must be chosen over any single
    expect(move.captures.length).toBe(2)
  })

  it('is deterministic given a seeded rand', () => {
    const s = createInitialState(8)
    const view = computeViews(s, 1, null)['1']!
    const a = selectMachineMove(view, seededRand(7))
    const b = selectMachineMove(view, seededRand(7))
    expect(a).toEqual(b)
  })
})
