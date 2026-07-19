-- Deploy fnb-agent:00000000011100_agent to pg

begin;

create schema agent;

CREATE TYPE agent.workflow_run_status AS ENUM ('running', 'success', 'error');

-- One row per agent execution of an fnb workflow. The app-side observability substitute for
-- the retired wf uow DAG: enough for "is a sync running?", "when did the last one finish?",
-- and the reaper's attempt cap — the step-level record is the per-run transcript JSONL
-- (/data/transcripts/<runId>.jsonl on the agent-transcripts volume).
CREATE TABLE agent.workflow_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_key citext NOT NULL,              -- 'asset-scan' | 'sync-breweries' | ...
  agent_session_id text,                     -- SDK session id (correlates to the transcript)
  model text,                                -- model that ran it (audit + cost attribution)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable: dataset syncs are anchor-wide
  status agent.workflow_run_status NOT NULL DEFAULT 'running',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tokens, turns, cost_usd from the SDK result
  started_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_agent_workflow_run_key_status ON agent.workflow_run (workflow_key, status);
CREATE INDEX idx_agent_workflow_run_input ON agent.workflow_run USING gin (input_data);

commit;
