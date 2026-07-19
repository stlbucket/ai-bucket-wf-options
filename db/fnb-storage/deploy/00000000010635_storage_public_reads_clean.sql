-------------------------------------- public reads — add scan_status = 'clean' gate (quarantine-first)
-- Rework of storage.public_asset / storage.public_assets_for_subject: a pending/infected public
-- asset must never be returned to anon. The object only reaches its final public/ prefix on a
-- clean verdict, so public reads hard-filter scan_status = 'clean' in addition to is_public + active.

-- returns 0/1 row for a known asset id, only if public + active + CLEAN
create or replace function storage.public_asset(_id uuid)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.id = _id and a.is_public and a.asset_status = 'active'
      and a.scan_status = 'clean';
  $$;

-- public assets attached to a subject (the "query related files" access, public variant)
create or replace function storage.public_assets_for_subject(_subject_urn text)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.subject_urn = _subject_urn
      and a.is_public and a.asset_status = 'active'
      and a.scan_status = 'clean'
    order by a.created_at desc;
  $$;
