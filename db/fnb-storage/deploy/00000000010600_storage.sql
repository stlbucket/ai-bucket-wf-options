create schema storage;

create type storage.scan_status   as enum ('pending', 'clean', 'infected', 'error');
create type storage.asset_status  as enum ('active', 'deleted');

create table storage.asset (
  id uuid not null default gen_random_uuid() primary key
  ,tenant_id uuid not null references app.tenant(id)
  ,resident_urn text not null references res.resource(urn)  -- uploader
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,is_public boolean not null default false    -- immutable at upload; drives visibility prefix + anon RLS
  ,original_name text not null
  ,extension text not null
  ,content_type text not null
  ,size_bytes bigint not null
  ,bucket text not null
  ,storage_key text not null                   -- MinIO object key (computed by the endpoint)
  ,checksum_sha256 text not null
  ,scan_status storage.scan_status not null default 'pending'
  ,scan_signature text                         -- ClamAV signature name when infected
  ,asset_status storage.asset_status not null default 'active'
  ,tags citext[] not null default '{}'::citext[]
  ,parent_asset_id uuid null references storage.asset(id)
  ,wf_id uuid null                             -- asset-scan workflow instance; NO FK (wf has its own RLS), deliberately loose
  ,subject_urn text null references res.resource(urn)  -- stacking: the business object this asset attaches to
  ,urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'storage', 'asset', id)) stored
  ,constraint uq_asset_urn unique (urn)
  ,constraint fk_asset_resource foreign key (id) references res.resource(id)
    deferrable initially deferred
);
create unique index uq_asset_storage_key on storage.asset (bucket, storage_key);
create index idx_asset_tenant_id on storage.asset (tenant_id);
create index idx_asset_resident_urn on storage.asset (resident_urn);
create index idx_asset_subject_urn on storage.asset (subject_urn)                     -- hub reverse relation
  where subject_urn is not null;
create index idx_asset_public on storage.asset (is_public) where is_public;          -- anon public reads
create index idx_asset_parent_asset_id on storage.asset (parent_asset_id)             -- child lookups + idempotency guard
  where parent_asset_id is not null;
