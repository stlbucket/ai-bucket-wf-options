import { Cron } from 'croner'
import { agentWorkerQuery } from '../lib/agent-tools/pg'
import { requiredEnv } from '../lib/required-env'

// In-process croner scheduler (_shared.data.md → Harness → Scheduling). The only job in scope
// is the asset-scan reaper — DETERMINISTIC code, not an agent: "re-fire stuck pending assets"
// has zero judgment, so no model call is spent on it. No external job queue anywhere.
//
// Reaper contract (asset-scan.workflow.data.md → Reaper): storage_fn.stuck_pending_assets
// returns pending assets past the threshold and under the attempt cap (and flips at-cap assets
// to terminal 'error' itself); each row gets a sequential self-POST through the ONE trigger
// path that serves fresh and reaped scans alike.
export default defineNitroPlugin(() => {
  // Boot reconciliation: a restart kills every in-flight SDK run with the process, so any row
  // still 'running' at boot is orphaned — without this sweep a stranded row would block
  // singleton workflows (sync-*) forever. In dev, nitro hot reloads restart the server worker
  // and re-run plugins, which is exactly when in-flight runs die — the sweep firing per
  // reload is correct, not incidental.
  agentWorkerQuery<{ sweep_orphaned_runs: number }>(
    'select agent_fn.sweep_orphaned_runs() as sweep_orphaned_runs'
  )
    .then(({ rows }) => {
      const swept = rows[0]?.sweep_orphaned_runs ?? 0
      if (swept > 0) {
        console.warn(`[agent-boot-sweep] marked ${swept} orphaned run(s) as error`)
      }
    })
    .catch((err) => {
      console.error('[agent-boot-sweep] sweep failed:', err)
    })

  const cronExpr = requiredEnv('ASSET_SCAN_REAPER_CRON')

  new Cron(cronExpr, { name: 'asset-scan-reaper', protect: true }, async () => {
    try {
      const stuckMinutes = parseInt(requiredEnv('ASSET_SCAN_STUCK_MINUTES'))
      const maxAttempts = parseInt(requiredEnv('ASSET_SCAN_MAX_WF_ATTEMPTS'))
      const { rows } = await agentWorkerQuery<{
        asset_id: string
        tenant_id: string
        ai_tags_requested: boolean
      }>('select * from storage_fn.stuck_pending_assets($1::int, $2::int)', [
        stuckMinutes,
        maxAttempts
      ])

      if (rows.length) {
        console.info(`[asset-scan-reaper] re-firing ${rows.length} stuck pending asset(s)`)
      }
      for (const row of rows) {
        try {
          const response = await fetch(
            `http://127.0.0.1:${process.env.NUXT_PORT ?? '3000'}/api/trigger/asset-scan`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-fnb-trigger-secret': requiredEnv('AGENT_TRIGGER_SECRET')
              },
              body: JSON.stringify({
                assetId: row.asset_id,
                tenantId: row.tenant_id,
                aiTagsRequested: row.ai_tags_requested
              })
            }
          )
          if (!response.ok && response.status !== 202) {
            console.error(
              `[asset-scan-reaper] re-fire failed for ${row.asset_id}: ${response.status}`
            )
          }
        } catch (err) {
          console.error(`[asset-scan-reaper] re-fire failed for ${row.asset_id}:`, err)
        }
      }
    } catch (err) {
      console.error('[asset-scan-reaper] tick failed:', err)
    }
  })

  console.info(`[agent-scheduler] asset-scan-reaper scheduled (${cronExpr})`)
})
