import { describe, expect, it } from 'vitest'
import type { BattleshipPlayerView, BattleshipTargetCell } from '@function-bucket/fnb-types'
import { selectMachineMove } from '@/battleship/select-move'
import { seededRand } from './engine.spec'

function viewWith(board: BattleshipTargetCell[][]): BattleshipPlayerView {
  return {
    seat: 2,
    boardSize: board.length,
    you: { board: board.map((r) => r.map(() => 'empty' as const)), fleet: [] },
    opponent: { board, sunkShips: [] },
  }
}

function blankBoard(size: number): BattleshipTargetCell[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'unknown' as const))
}

describe('selectMachineMove', () => {
  it('never repeats a shot across a full game sweep', () => {
    const board = blankBoard(10)
    const rand = seededRand(9)
    const fired = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const { row, col } = selectMachineMove(viewWith(board), rand)
      const key = `${row},${col}`
      expect(fired.has(key)).toBe(false)
      fired.add(key)
      board[row]![col] = 'miss'
    }
    expect(() => selectMachineMove(viewWith(board))).toThrow('No legal moves remain')
  })

  it('targets an orthogonal neighbor of an unresolved hit', () => {
    const board = blankBoard(10)
    board[5]![5] = 'hit'
    for (let i = 0; i < 20; i++) {
      const { row, col } = selectMachineMove(viewWith(board), seededRand(i))
      const neighbor =
        (Math.abs(row - 5) === 1 && col === 5) || (Math.abs(col - 5) === 1 && row === 5)
      expect(neighbor).toBe(true)
    }
  })

  it('ignores hits inside sunk ships (repainted sunk) and hunts on parity', () => {
    const board = blankBoard(10)
    board[0]![0] = 'sunk'
    board[0]![1] = 'sunk'
    const { row, col } = selectMachineMove(viewWith(board), seededRand(4))
    expect((row + col) % 2).toBe(0) // hunt mode prefers parity cells
  })
})
