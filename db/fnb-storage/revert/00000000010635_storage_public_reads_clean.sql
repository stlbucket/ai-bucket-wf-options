-- Restore the pre-quarantine-first public read functions (is_public + active only, no scan gate).
create or replace function storage.public_asset(_id uuid)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.id = _id and a.is_public and a.asset_status = 'active';
  $$;

create or replace function storage.public_assets_for_subject(_subject_urn text)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.subject_urn = _subject_urn
      and a.is_public and a.asset_status = 'active'
    order by a.created_at desc;
  $$;
