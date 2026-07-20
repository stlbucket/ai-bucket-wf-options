// The machine move-selection algorithm (canonical source — embedded into the game-event
// workflow's Code nodes by scripts/embed.mjs). Full contract:
// .claude/specs/game-server/game-event.workflow.data.md §Algorithm. Operates ONLY on the
// acting machine seat's redacted view (fairness — locked decision).

import type { BattleshipPlayerView } from '@function-bucket/fnb-types'

export interface SelectableCell {
  row: number
  col: number
}

/**
 * Selects the machine's next shot from its redacted view of the opponent board.
 * - TARGET mode: if any 'hit' cell is not part of a sunk ship, fire at a random
 *   orthogonal 'unknown' neighbor of a hit (finishes wounded ships).
 * - HUNT mode: otherwise fire at a random 'unknown' cell, preferring checkerboard
 *   parity cells (every ship of size ≥ 2 covers at least one parity cell).
 * Never repeats a shot; throws if no legal cell exists (referee treats as engine bug).
 */
export function selectMachineMove(
  view: BattleshipPlayerView,
  rand: () => number = Math.random,
): SelectableCell {
  const size = view.boardSize
  const board = view.opponent.board // 'unknown' | 'hit' | 'miss' | 'sunk'
  const unknown: SelectableCell[] = []
  const targets: SelectableCell[] = []

  const inBounds = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row]![col] === 'unknown') unknown.push({ row, col })
      if (board[row]![col] === 'hit') {
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const r = row + dr
          const c = col + dc
          if (inBounds(r, c) && board[r]![c] === 'unknown') targets.push({ row: r, col: c })
        }
      }
    }
  }

  const pick = (cells: SelectableCell[]) => cells[Math.floor(rand() * cells.length)]!
  if (targets.length) return pick(targets)
  if (!unknown.length) throw new Error('No legal moves remain')
  const parity = unknown.filter(({ row, col }) => (row + col) % 2 === 0)
  return pick(parity.length ? parity : unknown)
}
