create schema storage_fn;
create schema storage_api;

create type storage_fn.asset_info as (
  id               uuid    -- generated app-side so the storage_key uuid and row id match; nullable → falls back to gen_random_uuid()
 ,is_public        boolean
 ,original_name    text
 ,extension        text
 ,content_type     text
 ,size_bytes       bigint
 ,bucket           text
 ,storage_key      text
 ,checksum_sha256  text
 ,scan_status      storage.scan_status
 ,scan_signature   text
 ,tags             citext[]
 ,subject_urn      text       -- TRAILING position — keeps the endpoint's positional row(...) cast a one-param addition
);
