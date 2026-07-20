// game-engines has NO runtime app consumers (UI types come from fnb-types; the runtime
// consumer is the n8n Code node via scripts/embed.mjs, which bundles src/n8n-embed.ts →
// ./referee → the per-game modules). This barrel exports the battleship surface for
// convenience; the checkers module deliberately is NOT re-exported here to avoid `export *`
// name collisions (applyMove/computeViews/dehydrate/hydrate/selectMachineMove exist in both).
// Import checkers internals directly from '@/checkers/*' (tests) — see referee.ts dispatch.
export * from './battleship/engine'
export * from './battleship/serialize'
export * from './battleship/views'
export * from './battleship/select-move'
export * from './battleship/referee'
export * from './referee-types'
export * from './referee'
