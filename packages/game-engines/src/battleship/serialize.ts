// jsonb persistence adapters: PlacedShip.hits / GameState.shots are Sets in the engine and
// string[] in the stored blobs (locked decision — jsonb can't hold a Set). The engine's
// internals are untouched; all adaptation lives here.

import type { GameState, PlacedShip } from './engine'

export interface SerializedPlacedShip {
  name: string
  size: number
  cells: string[]
  hits: string[]
}

export interface SerializedGameState {
  boardSize: number
  ships: SerializedPlacedShip[]
  shots: string[]
  status: 'in_progress' | 'won'
}

export function dehydrate(state: GameState): SerializedGameState {
  return {
    boardSize: state.boardSize,
    ships: state.ships.map((s) => ({ name: s.name, size: s.size, cells: [...s.cells], hits: [...s.hits].sort() })),
    shots: [...state.shots].sort(),
    status: state.status,
  }
}

export function hydrate(s: SerializedGameState): GameState {
  const ships: PlacedShip[] = s.ships.map((sh) => ({
    name: sh.name,
    size: sh.size,
    cells: [...sh.cells],
    hits: new Set(sh.hits),
  }))
  return { boardSize: s.boardSize, ships, shots: new Set(s.shots), status: s.status }
}
