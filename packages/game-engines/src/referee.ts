// The game-type dispatcher — the entry points the n8n Code nodes call (embedded by
// scripts/embed.mjs). Adding a game type = a registry row + an engine module + a case here.

import { completeBattleshipAgentMove, refereeBattleship } from './battleship/referee'
import { completeCheckersAgentMove, refereeCheckers } from './checkers/referee'
import type { EngineContext, RefereeResult } from './referee-types'

export type RefereeOp = 'setup' | 'event'

export function runReferee(ctx: EngineContext, op: RefereeOp, rand: () => number = Math.random): RefereeResult {
  switch (ctx.gameType.id) {
    case 'battleship':
      return refereeBattleship(ctx, op, rand)
    case 'checkers':
      return refereeCheckers(ctx, op, rand)
    default:
      throw new Error(`No engine implemented for game type '${ctx.gameType.id}'`)
  }
}

export function completeAgentMove(
  ctx: EngineContext,
  referee: RefereeResult,
  agentText: string,
  rand: () => number = Math.random,
): RefereeResult {
  switch (ctx.gameType.id) {
    case 'battleship':
      return completeBattleshipAgentMove(ctx, referee, agentText, rand)
    case 'checkers':
      return completeCheckersAgentMove(ctx, referee, agentText, rand)
    default:
      throw new Error(`No engine implemented for game type '${ctx.gameType.id}'`)
  }
}
