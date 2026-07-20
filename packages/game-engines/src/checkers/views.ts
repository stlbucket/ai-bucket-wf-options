// Per-seat view computation for checkers. Checkers hides no information, so redaction is the
// IDENTITY on the board — both seats see the same full board. The only per-seat differences:
// `yourSeat`, and `legalMoves` populated ONLY in the seat-to-move's own view (so a machine
// seat still selects from its OWN view's legalMoves — the platform fairness contract holds
// trivially). Same per-seat-view shape the platform stores in player_views_after.

import type { CheckersMove, CheckersPlayerView } from '@function-bucket/fnb-types'
import { cloneBoard, type CheckersState } from './engine'
import { legalMovesFor } from './legal-moves'

export function computeSeatView(state: CheckersState, seat: number, toMoveSeat: number, lastMove: CheckersMove | null): CheckersPlayerView {
  return {
    seat,
    boardSize: state.boardSize,
    board: cloneBoard(state.board),
    yourSeat: seat,
    toMove: toMoveSeat,
    lastMove: lastMove ?? null,
    legalMoves: seat === toMoveSeat ? legalMovesFor(state, seat) : [],
  }
}

/** Both seats' views. Keys are seat numbers as strings (platform contract). */
export function computeViews(state: CheckersState, toMoveSeat: number, lastMove: CheckersMove | null): Record<string, CheckersPlayerView> {
  return {
    '1': computeSeatView(state, 1, toMoveSeat, lastMove),
    '2': computeSeatView(state, 2, toMoveSeat, lastMove),
  }
}
