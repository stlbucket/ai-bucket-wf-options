// Battleship per-seat redacted view shapes — mirrors the player_views_after seat blobs
// computed by packages/game-engines (.claude/specs/game-server/_shared.data.md
// §player_views_after). Shared vocabulary across the engine package, the workflow
// contract, and the UI.

export type BattleshipOwnCell = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk'
export type BattleshipTargetCell = 'unknown' | 'hit' | 'miss' | 'sunk'

export interface BattleshipFleetEntry {
  name: string
  size: number
  hitCount: number
  sunk: boolean
}

export interface BattleshipPlayerView {
  seat: number
  boardSize: number
  you: {
    board: BattleshipOwnCell[][] // own fleet overlaid with incoming shots
    fleet: BattleshipFleetEntry[]
  }
  opponent: {
    board: BattleshipTargetCell[][] // ONLY your shot results — no ships
    sunkShips: Array<{ name: string; size: number }>
  }
}
