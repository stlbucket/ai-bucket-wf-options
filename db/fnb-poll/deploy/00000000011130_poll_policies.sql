--- poll_api policies
grant usage on schema poll_api to anon, authenticated, service_role;
grant all on all tables in schema poll_api to anon, authenticated, service_role;
grant all on all routines in schema poll_api to anon, authenticated, service_role;
grant all on all sequences in schema poll_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_api grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_api grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_api grant all on sequences to anon, authenticated, service_role;

--- poll_fn policies
grant usage on schema poll_fn to anon, authenticated, service_role;
grant all on all tables in schema poll_fn to anon, authenticated, service_role;
grant all on all routines in schema poll_fn to anon, authenticated, service_role;
grant all on all sequences in schema poll_fn to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_fn grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_fn grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll_fn grant all on sequences to anon, authenticated, service_role;

--- poll policies
grant usage on schema poll to anon, authenticated, service_role;
grant all on all tables in schema poll to anon, authenticated, service_role;
grant all on all routines in schema poll to anon, authenticated, service_role;
grant all on all sequences in schema poll to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema poll grant all on sequences to anon, authenticated, service_role;

------------------------------------------------------------------------ poll.poll
-- Readable by tenant members, but a member sees another member's DRAFT only if they own it or
-- administer polls. Writes are tenant-fenced; the creator-or-admin business gate lives in poll_api.
alter table poll.poll enable row level security;
CREATE POLICY read_poll ON poll.poll FOR SELECT
  USING (
    jwt.tenant_id()::uuid = tenant_id
    and (
      status != 'draft'
      or created_by_resident_urn = (select urn from app.resident where id = jwt.resident_id())
      or jwt.has_permission('p:poll-admin', tenant_id)
    )
  );
CREATE POLICY write_poll_ins ON poll.poll FOR INSERT
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_poll_upd ON poll.poll FOR UPDATE
  USING (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_poll_del ON poll.poll FOR DELETE
  USING (jwt.tenant_id()::uuid = tenant_id);

------------------------------------------------------------------------ poll.question
-- SELECT follows the parent poll's draft visibility; writes are tenant-fenced (gated in poll_api).
alter table poll.question enable row level security;
CREATE POLICY read_question ON poll.question FOR SELECT
  USING (
    exists (
      select 1 from poll.poll p
      where p.id = poll_id
        and jwt.tenant_id()::uuid = p.tenant_id
        and (
          p.status != 'draft'
          or p.created_by_resident_urn = (select urn from app.resident where id = jwt.resident_id())
          or jwt.has_permission('p:poll-admin', p.tenant_id)
        )
    )
  );
CREATE POLICY write_question_ins ON poll.question FOR INSERT
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_question_upd ON poll.question FOR UPDATE
  USING (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_question_del ON poll.question FOR DELETE
  USING (jwt.tenant_id()::uuid = tenant_id);

------------------------------------------------------------------------ poll.option
alter table poll.option enable row level security;
CREATE POLICY read_option ON poll.option FOR SELECT
  USING (
    exists (
      select 1 from poll.poll p
      where p.id = poll_id
        and jwt.tenant_id()::uuid = p.tenant_id
        and (
          p.status != 'draft'
          or p.created_by_resident_urn = (select urn from app.resident where id = jwt.resident_id())
          or jwt.has_permission('p:poll-admin', p.tenant_id)
        )
    )
  );
CREATE POLICY write_option_ins ON poll.option FOR INSERT
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_option_upd ON poll.option FOR UPDATE
  USING (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
CREATE POLICY write_option_del ON poll.option FOR DELETE
  USING (jwt.tenant_id()::uuid = tenant_id);

------------------------------------------------------------------------ poll.response
-- Own rows: full read + write ("users can change ONLY their answers"). Others' rows: readable only
-- when the poll is attributed, or the caller administers polls.
alter table poll.response enable row level security;
CREATE POLICY own_response ON poll.response FOR ALL
  USING (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  )
  WITH CHECK (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  );
CREATE POLICY read_others_response ON poll.response FOR SELECT
  USING (
    jwt.tenant_id()::uuid = tenant_id
    and (
      jwt.has_permission('p:poll-admin', tenant_id)
      or exists (select 1 from poll.poll p where p.id = poll_id and p.results_visibility = 'attributed')
    )
  );

------------------------------------------------------------------------ poll.answer
alter table poll.answer enable row level security;
CREATE POLICY own_answer ON poll.answer FOR ALL
  USING (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  )
  WITH CHECK (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  );
CREATE POLICY read_others_answer ON poll.answer FOR SELECT
  USING (
    jwt.tenant_id()::uuid = tenant_id
    and (
      jwt.has_permission('p:poll-admin', tenant_id)
      or exists (select 1 from poll.poll p where p.id = poll_id and p.results_visibility = 'attributed')
    )
  );
