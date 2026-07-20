// Legal-move generation — English/American draughts rules (locked 2026-07-20):
//  - FORCED CAPTURE: if any capture exists for the seat, ONLY captures are legal.
//  - Chained multi-jumps: a capturing piece must continue jumping until it can jump no more;
//    each maximal chain is ONE CheckersLegalMove (path = landing squares, captures = jumped).
//  - Free choice among capturing pieces — NO maximal-length rule (that is international).
//  - Men move/capture diagonally FORWARD only; kings one step in ANY diagonal.
//  - Kinging ends the turn: a man that reaches its king row during a jump is crowned and the
//    chain stops there (it does not continue as a fresh king that turn).
//
// The single source of checkers rule truth — consumed by the referee (validation), the
// machine selector, the agent, and surfaced in the per-seat view for the UI.

import type { CheckersCell, CheckersLegalMove, CheckersPiece, CheckersSquare } from '@function-bucket/fnb-types'
import { cloneBoard, forwardDir, inBounds, isPlayable, kingRow, type CheckersState } from './engine'

const ALL_DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

function directionsFor(piece: CheckersPiece): ReadonlyArray<readonly [number, number]> {
  if (piece.king) return ALL_DIAGONALS
  const dr = forwardDir(piece.seat)
  return [
    [dr, -1],
    [dr, 1],
  ]
}

function enemyAt(board: CheckersCell[][], row: number, col: number, seat: number): boolean {
  const cell = board[row]?.[col]
  return !!cell && cell.seat !== seat
}

function emptyAt(board: CheckersCell[][], row: number, col: number): boolean {
  return (board[row]?.[col] ?? null) === null
}

/**
 * All maximal capture chains starting from `from` with `piece`. Captured pieces are removed
 * from the working board as each hop is taken (so they cannot be jumped twice and cannot block
 * a later landing — standard). Promotion terminates the chain (kinging ends the turn).
 */
function captureChains(
  state: CheckersState,
  seat: number,
  from: CheckersSquare,
  piece: CheckersPiece,
): CheckersLegalMove[] {
  const results: CheckersLegalMove[] = []
  const size = state.boardSize

  function dfs(cur: CheckersSquare, curPiece: CheckersPiece, board: CheckersCell[][], path: CheckersSquare[], captures: CheckersSquare[]): void {
    let extended = false
    for (const [dr, dc] of directionsFor(curPiece)) {
      const mid = { row: cur.row + dr, col: cur.col + dc }
      const land = { row: cur.row + 2 * dr, col: cur.col + 2 * dc }
      if (!inBounds(land.row, land.col, size) || !isPlayable(land.row, land.col)) continue
      if (!enemyAt(board, mid.row, mid.col, seat)) continue
      if (!emptyAt(board, land.row, land.col)) continue

      extended = true
      const promotes = !curPiece.king && land.row === kingRow(seat, size)
      const nextBoard = cloneBoard(board)
      nextBoard[cur.row]![cur.col] = null
      nextBoard[mid.row]![mid.col] = null
      const nextPiece: CheckersPiece = { seat, king: curPiece.king || promotes }
      nextBoard[land.row]![land.col] = nextPiece

      if (promotes) {
        results.push({ from, path: [...path, land], captures: [...captures, mid] })
      } else {
        dfs(land, nextPiece, nextBoard, [...path, land], [...captures, mid])
      }
    }
    if (!extended && path.length > 0) {
      results.push({ from, path: [...path], captures: [...captures] })
    }
  }

  dfs(from, piece, cloneBoard(state.board), [], [])
  return results
}

/** Simple one-step diagonal slides to an empty playable square (no captures available). */
function slidesFor(state: CheckersState, seat: number, from: CheckersSquare, piece: CheckersPiece): CheckersLegalMove[] {
  const out: CheckersLegalMove[] = []
  const size = state.boardSize
  for (const [dr, dc] of directionsFor(piece)) {
    const to = { row: from.row + dr, col: from.col + dc }
    if (!inBounds(to.row, to.col, size) || !isPlayable(to.row, to.col)) continue
    if (emptyAt(state.board, to.row, to.col)) out.push({ from, path: [to], captures: [] })
  }
  return out
}

/** Every legal move for `seat` under English rules (captures only when any capture exists). */
export function legalMovesFor(state: CheckersState, seat: number): CheckersLegalMove[] {
  const captures: CheckersLegalMove[] = []
  const slides: CheckersLegalMove[] = []
  for (let row = 0; row < state.boardSize; row++) {
    for (let col = 0; col < state.boardSize; col++) {
      const piece = state.board[row]?.[col] ?? null
      if (!piece || piece.seat !== seat) continue
      const from = { row, col }
      captures.push(...captureChains(state, seat, from, piece))
      slides.push(...slidesFor(state, seat, from, piece))
    }
  }
  // Forced capture: if any capture exists, only captures are legal.
  return captures.length > 0 ? captures : slides
}

export function hasAnyMove(state: CheckersState, seat: number): boolean {
  return legalMovesFor(state, seat).length > 0
}

/** Structural equality of a submitted {from, path} against an enumerated legal move. */
export function sameMove(a: { from: CheckersSquare; path: CheckersSquare[] }, b: CheckersLegalMove): boolean {
  if (a.from.row !== b.from.row || a.from.col !== b.from.col) return false
  if (a.path.length !== b.path.length) return false
  return a.path.every((sq, i) => sq.row === b.path[i]!.row && sq.col === b.path[i]!.col)
}
