// Checkers per-seat view shapes — mirrors the player_views_after seat blobs computed by
// packages/game-engines (.claude/specs/game-server/checkers/_shared.data.md §player view).
// Checkers hides no information, so a seat's board is the FULL board; the only per-seat
// differences are `yourSeat` and whose `legalMoves` are populated. Shared vocabulary across
// the engine package, the workflow contract, and the UI.

export interface CheckersSquare {
  row: number
  col: number
}

export interface CheckersPiece {
  seat: number
  king: boolean
}

// null = empty playable square OR a non-playable (light) square
export type CheckersCell = CheckersPiece | null

export interface CheckersLegalMove {
  from: CheckersSquare
  path: CheckersSquare[] // ordered landing squares (1 = slide; ≥1 = jump chain)
  captures: CheckersSquare[] // squares jumped (empty for a slide)
}

export interface CheckersMove {
  seat?: number
  from: CheckersSquare
  path: CheckersSquare[]
  captured?: CheckersSquare[]
}

export interface CheckersPlayerView {
  seat: number
  boardSize: number
  board: CheckersCell[][] // full board — checkers hides nothing
  yourSeat: number
  toMove: number
  lastMove: CheckersMove | null
  legalMoves: CheckersLegalMove[] // populated only in the seat-to-move's own view
}
