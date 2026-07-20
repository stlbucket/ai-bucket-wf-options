// jsonb persistence adapters for checkers. Unlike battleship (whose PlacedShip.hits is a Set),
// checkers state is JSON-native, so hydrate/dehydrate are the IDENTITY — kept only so the
// referee has a uniform interface across game types.

import type { CheckersState } from './engine'

export interface CheckersStateBlob {
  gameType: 'checkers'
  boardSize: number
  board: CheckersState['board']
  moveCount: number
}

export function dehydrate(state: CheckersState): CheckersStateBlob {
  return { gameType: 'checkers', boardSize: state.boardSize, board: state.board, moveCount: state.moveCount }
}

export function hydrate(blob: CheckersStateBlob): CheckersState {
  return { boardSize: blob.boardSize, board: blob.board, moveCount: blob.moveCount }
}
