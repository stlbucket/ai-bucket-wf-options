// Per-seat redacted view computation (.claude/specs/game-server/_shared.data.md
// §player_views_after). Redaction is game logic, so it lives HERE, not in SQL: a seat sees
// its own fleet fully, and of the opponent board ONLY its shot results — never unhit ships.
// Machine seats select moves from these same views (fairness lock).

import type { BattleshipOwnCell, BattleshipPlayerView, BattleshipTargetCell } from '@function-bucket/fnb-types'
import { cellKey, isSunk, type GameState } from './engine'

/** The view for `seat`, whose own fleet board is `own` and whose opponent's board is `opponent`. */
export function computeSeatView(seat: number, own: GameState, opponent: GameState): BattleshipPlayerView {
  const size = own.boardSize

  // own board: my fleet overlaid with the incoming shots recorded on MY board
  const ownBoard: BattleshipOwnCell[][] = []
  const ownShipCells = new Map<string, { sunk: boolean }>()
  for (const ship of own.ships) {
    const sunk = isSunk(ship)
    for (const c of ship.cells) ownShipCells.set(c, { sunk })
  }
  for (let row = 0; row < size; row++) {
    const line: BattleshipOwnCell[] = []
    for (let col = 0; col < size; col++) {
      const key = cellKey(row, col)
      const ship = ownShipCells.get(key)
      const shot = own.shots.has(key)
      if (ship && shot) line.push(ship.sunk ? 'sunk' : 'hit')
      else if (ship) line.push('ship')
      else if (shot) line.push('miss')
      else line.push('empty')
    }
    ownBoard.push(line)
  }

  // opponent board: ONLY my shot results against their board — no ships
  const oppBoard: BattleshipTargetCell[][] = []
  const oppShipCells = new Map<string, { sunk: boolean }>()
  for (const ship of opponent.ships) {
    const sunk = isSunk(ship)
    for (const c of ship.cells) oppShipCells.set(c, { sunk })
  }
  for (let row = 0; row < size; row++) {
    const line: BattleshipTargetCell[] = []
    for (let col = 0; col < size; col++) {
      const key = cellKey(row, col)
      if (!opponent.shots.has(key)) {
        line.push('unknown')
        continue
      }
      const ship = oppShipCells.get(key)
      if (!ship) line.push('miss')
      else line.push(ship.sunk ? 'sunk' : 'hit')
    }
    oppBoard.push(line)
  }

  return {
    seat,
    boardSize: size,
    you: {
      board: ownBoard,
      fleet: own.ships.map((s) => ({
        name: s.name,
        size: s.size,
        hitCount: s.hits.size,
        sunk: isSunk(s),
      })),
    },
    opponent: {
      board: oppBoard,
      sunkShips: opponent.ships.filter(isSunk).map((s) => ({ name: s.name, size: s.size })),
    },
  }
}

/** Both seats' views for a two-seat battleship game. Keys are seat numbers as strings. */
export function computeViews(seats: Record<string, GameState>): Record<string, BattleshipPlayerView> {
  const seatNumbers = Object.keys(seats)
    .map(Number)
    .sort((a, b) => a - b)
  if (seatNumbers.length !== 2) {
    throw new Error(`battleship expects exactly 2 seats, got ${seatNumbers.length}`)
  }
  const [a, b] = seatNumbers as [number, number]
  return {
    [String(a)]: computeSeatView(a, seats[String(a)]!, seats[String(b)]!),
    [String(b)]: computeSeatView(b, seats[String(b)]!, seats[String(a)]!),
  }
}
