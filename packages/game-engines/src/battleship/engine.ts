// The single-board battleship engine — authored fresh (user decision 2026-07-19 at the
// implementation go/no-go; the originally referenced user-supplied battleship.ts was never
// added to the repo). Contract per .claude/specs/game-server/: createInitialGameState() +
// applyMove(), PlacedShip.hits as Set<string>, board status 'won' when every ship on it is
// sunk (the board's OWNER has lost — the wrapper maps this to seat outcomes).
//
// Pure and deterministic given `rand` — no I/O, no Date, no ambient randomness.

export interface Ship {
  name: string
  size: number
}

export const STANDARD_FLEET: Ship[] = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 },
]

export interface Cell {
  row: number
  col: number
}

/** Canonical cell key: "row,col" */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function parseCellKey(key: string): Cell {
  const [row, col] = key.split(',').map(Number)
  return { row: row!, col: col! }
}

export interface PlacedShip {
  name: string
  size: number
  cells: string[] // cellKeys this ship occupies
  hits: Set<string> // subset of cells that have been hit
}

export type BoardStatus = 'in_progress' | 'won'

export interface GameState {
  boardSize: number
  ships: PlacedShip[]
  shots: Set<string> // every cell ever fired at this board
  status: BoardStatus // 'won' ⇒ all ships sunk ⇒ this board's owner LOST
}

export type MoveOutcome = 'hit' | 'miss' | 'sunk'

export interface AppliedMove {
  state: GameState
  outcome: MoveOutcome
  sunkShip: Ship | null // set when outcome === 'sunk'
}

export function isSunk(ship: PlacedShip): boolean {
  return ship.cells.every((c) => ship.hits.has(c))
}

/**
 * Random non-overlapping fleet placement. Rejection-sampled per ship (a 10×10 board with
 * the standard fleet places in a handful of tries); throws only if the fleet genuinely
 * cannot fit, after a generous attempt budget.
 */
export function createInitialGameState(
  boardSize = 10,
  fleet: Ship[] = STANDARD_FLEET,
  rand: () => number = Math.random,
): GameState {
  const occupied = new Set<string>()
  const ships: PlacedShip[] = []

  for (const ship of fleet) {
    let placed = false
    for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
      const horizontal = rand() < 0.5
      const maxRow = horizontal ? boardSize : boardSize - ship.size
      const maxCol = horizontal ? boardSize - ship.size : boardSize
      const row = Math.floor(rand() * maxRow)
      const col = Math.floor(rand() * maxCol)
      const cells: string[] = []
      for (let i = 0; i < ship.size; i++) {
        cells.push(horizontal ? cellKey(row, col + i) : cellKey(row + i, col))
      }
      if (cells.some((c) => occupied.has(c))) continue
      cells.forEach((c) => occupied.add(c))
      ships.push({ name: ship.name, size: ship.size, cells, hits: new Set() })
      placed = true
    }
    if (!placed) {
      throw new Error(`Could not place ship ${ship.name} (size ${ship.size}) on a ${boardSize}×${boardSize} board`)
    }
  }

  return { boardSize, ships, shots: new Set(), status: 'in_progress' }
}

/**
 * Fires at `move` on this board. Returns a NEW state (the input is not mutated).
 * Throws RangeError when out of bounds and Error('ALREADY_FIRED') on a repeated shot —
 * the referee catches and maps these to rejections.
 */
export function applyMove(state: GameState, move: Cell): AppliedMove {
  const { row, col } = move
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= state.boardSize || col >= state.boardSize) {
    throw new RangeError('OUT_OF_BOUNDS')
  }
  const key = cellKey(row, col)
  if (state.shots.has(key)) {
    throw new Error('ALREADY_FIRED')
  }

  const shots = new Set(state.shots)
  shots.add(key)

  let outcome: MoveOutcome = 'miss'
  let sunkShip: Ship | null = null
  const ships = state.ships.map((ship) => {
    if (!ship.cells.includes(key)) return ship
    const hits = new Set(ship.hits)
    hits.add(key)
    const next: PlacedShip = { ...ship, hits }
    if (isSunk(next)) {
      outcome = 'sunk'
      sunkShip = { name: ship.name, size: ship.size }
    } else {
      outcome = 'hit'
    }
    return next
  })

  const status: BoardStatus = ships.every(isSunk) ? 'won' : 'in_progress'
  return { state: { boardSize: state.boardSize, ships, shots, status }, outcome, sunkShip }
}
