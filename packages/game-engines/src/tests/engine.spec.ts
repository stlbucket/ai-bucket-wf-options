import { describe, expect, it } from 'vitest'
import {
  applyMove,
  cellKey,
  createInitialGameState,
  isSunk,
  STANDARD_FLEET,
} from '@/battleship/engine'
import { dehydrate, hydrate } from '@/battleship/serialize'

/** mulberry32 — deterministic PRNG for reproducible placements */
export function seededRand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('createInitialGameState', () => {
  it('places the standard fleet with no overlaps, all in bounds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = createInitialGameState(10, STANDARD_FLEET, seededRand(seed))
      expect(state.ships).toHaveLength(5)
      const seen = new Set<string>()
      for (const ship of state.ships) {
        expect(ship.cells).toHaveLength(ship.size)
        for (const cell of ship.cells) {
          expect(seen.has(cell)).toBe(false)
          seen.add(cell)
          const [row, col] = cell.split(',').map(Number)
          expect(row).toBeGreaterThanOrEqual(0)
          expect(row).toBeLessThan(10)
          expect(col).toBeGreaterThanOrEqual(0)
          expect(col).toBeLessThan(10)
        }
      }
      expect(seen.size).toBe(17) // 5+4+3+3+2
      expect(state.status).toBe('in_progress')
      expect(state.shots.size).toBe(0)
    }
  })

  it('is deterministic for a given rand', () => {
    const a = createInitialGameState(10, STANDARD_FLEET, seededRand(42))
    const b = createInitialGameState(10, STANDARD_FLEET, seededRand(42))
    expect(dehydrate(a)).toEqual(dehydrate(b))
  })
})

describe('applyMove', () => {
  const state = createInitialGameState(10, STANDARD_FLEET, seededRand(7))

  it('records a miss on open water', () => {
    const shipCells = new Set(state.ships.flatMap((s) => s.cells))
    let target: { row: number; col: number } | null = null
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!shipCells.has(cellKey(r, c))) {
          target = { row: r, col: c }
          break outer
        }
      }
    }
    const applied = applyMove(state, target!)
    expect(applied.outcome).toBe('miss')
    expect(applied.state.shots.size).toBe(1)
    expect(state.shots.size).toBe(0) // input not mutated
  })

  it('hits, then sinks a ship, then wins the board', () => {
    let current = state
    // sink every ship cell by cell
    for (const ship of state.ships) {
      for (let i = 0; i < ship.cells.length; i++) {
        const [row, col] = ship.cells[i]!.split(',').map(Number)
        const applied = applyMove(current, { row: row!, col: col! })
        current = applied.state
        if (i < ship.cells.length - 1) {
          expect(applied.outcome).toBe('hit')
        } else {
          expect(applied.outcome).toBe('sunk')
          expect(applied.sunkShip?.name).toBe(ship.name)
        }
      }
    }
    expect(current.status).toBe('won')
    expect(current.ships.every(isSunk)).toBe(true)
  })

  it('throws OUT_OF_BOUNDS and ALREADY_FIRED', () => {
    expect(() => applyMove(state, { row: -1, col: 0 })).toThrow(RangeError)
    expect(() => applyMove(state, { row: 0, col: 10 })).toThrow(RangeError)
    expect(() => applyMove(state, { row: 0.5, col: 1 })).toThrow(RangeError)
    const once = applyMove(state, { row: 0, col: 0 }).state
    expect(() => applyMove(once, { row: 0, col: 0 })).toThrow('ALREADY_FIRED')
  })
})

describe('serialize', () => {
  it('round-trips through jsonb-safe shapes', () => {
    let state = createInitialGameState(10, STANDARD_FLEET, seededRand(3))
    state = applyMove(state, { row: 0, col: 0 }).state
    state = applyMove(state, { row: 5, col: 5 }).state
    const rehydrated = hydrate(JSON.parse(JSON.stringify(dehydrate(state))))
    expect(dehydrate(rehydrated)).toEqual(dehydrate(state))
    expect(rehydrated.shots).toBeInstanceOf(Set)
    expect(rehydrated.ships[0]!.hits).toBeInstanceOf(Set)
  })
})
