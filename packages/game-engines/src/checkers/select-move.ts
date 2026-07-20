// The machine move-selection algorithm for checkers (canonical source — embedded into the
// game-event workflow's Code nodes by scripts/embed.mjs). Operates ONLY on the acting machine
// seat's view (fairness — locked decision; checkers hides nothing, but the contract is the
// same). Forced capture already guarantees the legalMoves are captures when any exist; among
// candidates it prefers the longest capture chain, breaking ties (and picking among slides) at
// random. Never returns an illegal move.

import type { CheckersLegalMove, CheckersPlayerView } from '@function-bucket/fnb-types'

export function selectMachineMove(view: CheckersPlayerView, rand: () => number = Math.random): CheckersLegalMove {
  const moves = view.legalMoves
  if (!moves.length) throw new Error('No legal moves remain')
  const maxCaptures = Math.max(...moves.map((m) => m.captures.length))
  const best = moves.filter((m) => m.captures.length === maxCaptures)
  return best[Math.floor(rand() * best.length)]!
}
