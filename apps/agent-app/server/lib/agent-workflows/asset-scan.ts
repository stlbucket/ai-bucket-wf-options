import { z } from 'zod'
import { addAssetTags, getAsset, makeThumbnail, scanAndResolve } from '../agent-tools/asset-scan'
import type { AgentWorkflowDefinition } from './types'

// Agentic conversion of the asset-scan pipeline (asset-scan.workflow.data.md). The old fixed
// diamond (scan → resolve → thumbnail ∥ ai-tag → completed) becomes agent-sequenced calls over
// deterministic tools; the verdict itself is never the agent's to make.

const inputSchema = z.object({
  assetId: z.uuid(),
  tenantId: z.uuid(),
  aiTagsRequested: z.boolean()
})

type AssetScanInput = z.infer<typeof inputSchema>

export const assetScan: AgentWorkflowDefinition<AssetScanInput> = {
  key: 'asset-scan',
  inputSchema,
  maxTurns: 12, // not singleton — concurrent scans of different assets are normal
  tools: [getAsset, scanAndResolve, makeThumbnail, addAssetTags],
  goal: (input) => `Scan uploaded asset ${input.assetId}. aiTagsRequested is ${input.aiTagsRequested}.

1. Call get_asset for the metadata.
2. Call scan_and_resolve — its verdict is FINAL. Never try to influence or second-guess it.
   (If the tool itself errors, you may re-call it once — it is idempotent.)
3. If the verdict is "clean":
   - When the asset is an image (isImage from get_asset), attempt make_thumbnail. This is
     best-effort: on failure, note it in the result and continue.
   - When aiTagsRequested is true, call add_asset_tags with tags ["ai-tags-coming-soon"].
4. If the verdict is "infected" or "error": do no further asset work.
5. Always finish with complete_run({ verdict, signature?, thumbnail: "created"|"failed"|"skipped",
   aiTags: "added"|"skipped" }).`
}
