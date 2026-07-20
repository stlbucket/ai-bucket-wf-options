// The checkers board engine — English/American draughts (user decision 2026-07-20). 8×8,
// 12 men per side on dark squares; forced capture + chained multi-jumps live in legal-moves.ts.
// Contract per .claude/specs/game-server/checkers/. State is JSON-native (no Set), so the
// serialize adapter is identity — the board is stored and viewed as-is.
//
// Pure and deterministic — no I/O, no Date, no ambient randomness. Seat 1 = red, starts on
// the bottom rows and moves toward row 0 (dr = -1); seat 2 = black, starts on the top rows and
// moves toward row boardSize-1 (dr = +1). A playable (dark) square is where (row + col) is odd.

import type { CheckersCell, CheckersLegalMove, CheckersPiece, CheckersSquare } from '@function-bucket/fnb-types'

export interface CheckersState {
  boardSize: number
  board: CheckersCell[][]
  moveCount: number
}

/** Forward row-direction for a MAN of `seat`. Kings move both directions. */
export function forwardDir(seat: number): number {
  return seat === 1 ? -1 : 1
}

export function isPlayable(row: number, col: number): boolean {
  return (row + col) % 2 === 1
}

export function inBounds(row: number, col: number, boardSize: number): boolean {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize
}

/** The row a MAN of `seat` promotes on (the opponent's home row). */
export function kingRow(seat: number, boardSize: number): number {
  return seat === 1 ? 0 : boardSize - 1
}

/** Standard opening position: seats fill the dark squares of their three home rows. */
export function createInitialState(boardSize = 8): CheckersState {
  const board: CheckersCell[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null as CheckersCell),
  )
  const homeRows = 3
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (!isPlayable(row, col)) continue
      if (row < homeRows) board[row]![col] = { seat: 2, king: false }
      else if (row >= boardSize - homeRows) board[row]![col] = { seat: 1, king: false }
    }
  }
  return { boardSize, board, moveCount: 0 }
}

export function cloneBoard(board: CheckersCell[][]): CheckersCell[][] {
  return board.map((line) => line.map((cell) => (cell ? { ...cell } : null)))
}

export function pieceAt(board: CheckersCell[][], sq: CheckersSquare): CheckersPiece | null {
  return board[sq.row]?.[sq.col] ?? null
}

export function pieceCount(state: CheckersState, seat: number): number {
  let n = 0
  for (const line of state.board) for (const cell of line) if (cell && cell.seat === seat) n++
  return n
}

/**
 * Applies an already-validated legal move (from legal-moves.ts) for `seat`. Returns a NEW
 * state (input not mutated). Walks `move.path`: each two-step hop removes the jumped midpoint;
 * the piece lands on the final square and is crowned if it is a man reaching its king row
 * (kinging ends the turn — legal-moves.ts never emits a chain that continues past promotion).
 */
export function applyMove(state: CheckersState, seat: number, move: CheckersLegalMove): CheckersState {
  const board = cloneBoard(state.board)
  const start = pieceAt(board, move.from)
  if (!start || start.seat !== seat) throw new Error('ILLEGAL_MOVE: no piece of seat at from')

  board[move.from.row]![move.from.col] = null
  let cur: CheckersSquare = move.from
  let king = start.king
  for (const step of move.path) {
    if (Math.abs(step.row - cur.row) === 2) {
      const mid = { row: (cur.row + step.row) / 2, col: (cur.col + step.col) / 2 }
      board[mid.row]![mid.col] = null
    }
    cur = step
  }
  if (!king && cur.row === kingRow(seat, state.boardSize)) king = true
  board[cur.row]![cur.col] = { seat, king }

  return { boardSize: state.boardSize, board, moveCount: state.moveCount + 1 }
}
