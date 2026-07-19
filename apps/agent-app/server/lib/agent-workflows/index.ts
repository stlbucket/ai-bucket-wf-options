import { assetScan } from './asset-scan'
import { exerciser } from './exerciser'
import { syncAirports } from './sync-airports'
import { syncBreweries } from './sync-breweries'
import type { AgentWorkflowDefinition } from './types'

// The static workflow registry — agents-as-code, no runtime workflow store
// (_shared.data.md → Agents-as-code). Trigger routes and the scheduler resolve keys here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentWorkflows: Record<string, AgentWorkflowDefinition<any>> = {
  [exerciser.key]: exerciser,
  [syncBreweries.key]: syncBreweries,
  [syncAirports.key]: syncAirports,
  [assetScan.key]: assetScan
}
