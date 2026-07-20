// Dedicated bundle entry for the n8n Code-node embed (scripts/embed.mjs). Assigns PLAIN data
// properties onto globalThis — deliberately NOT `export * as` (esbuild's re-export getters
// did not survive n8n's Code-node sandbox in testing: "GameEngines.runReferee is not a
// function" even after the value reached globalThis). Keep this file minimal; it has no
// other consumer.
import { runReferee, completeAgentMove } from './referee'

;(globalThis as any).GameEngines = { runReferee, completeAgentMove }
