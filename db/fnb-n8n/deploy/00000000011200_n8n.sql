-- Deploy fnb-n8n:00000000011200_n8n to pg

begin;

create schema n8n;

-- Named n8n_workflow_run_status (not workflow_run_status): PostGraphile 5's typeCodecName
-- inflector ignores @name smart tags on types (unlike classCodecName for tables), and
-- agent.workflow_run_status already owns the 'workflowRunStatus' codec name — an identically
-- named enum here fails schema build with "Attempted to add a second codec" (observed live).
CREATE TYPE n8n.n8n_workflow_run_status AS ENUM ('running', 'success', 'error');

-- One row per n8n execution of an fnb workflow (n8n-parallel-engine spec). Flat run log, the
-- same deliberate ceiling as agent.workflow_run — step-level history lives in n8n's own
-- execution log (editor UI), correlated via n8n_execution_id. The n8n engine coexists with
-- the agentic engine; per-engine logs match the per-engine site-admin tools.
CREATE TABLE n8n.workflow_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_key citext NOT NULL,              -- 'n8n-exerciser' | future keys
  n8n_execution_id text,                     -- n8n's $execution.id (correlate to the n8n log)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable
  status n8n.n8n_workflow_run_status NOT NULL DEFAULT 'running',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_n8n_workflow_run_key_status ON n8n.workflow_run (workflow_key, status);
CREATE INDEX idx_n8n_workflow_run_execution ON n8n.workflow_run (n8n_execution_id);
CREATE INDEX idx_n8n_workflow_run_input ON n8n.workflow_run USING gin (input_data);

commit;
