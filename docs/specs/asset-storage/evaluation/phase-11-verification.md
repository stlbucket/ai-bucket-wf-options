# Asset Storage — Phase 11 Verification (Plan B)

**Date:** 2026-07-07 (UTC)
**Scope:** The negative-path verification runbook from `final-eval.md` §5 Plan B — the last
unverified spec behavior (M1). Run against the live Docker stack after Plan A ("phase a" commit)
was deployed. All checks were read-only except test uploads (which are the thing under test).
**Auth:** super-admin `bucket@function-bucket.net` via the real login endpoint; anon = no cookie.

## Results

| Case | Did | Result |
|---|---|---|
| Pending gate | Upload clean txt, query in the same second | ✅ `scanStatus: PENDING`, `downloadUrl: null`; flips to `CLEAN` + presigned URL (15-min expiry, `response-content-disposition` restores filename, presigned against `localhost:9000` = browser-reachable) within ~10 s |
| EICAR | Uploaded the 68-byte EICAR string as `eicar.txt` (`text/plain`) | ✅ 202 PENDING → row `infected` / `deleted` / `scan_signature = Eicar-Test-Signature`; quarantine object **purged** from minio (verified in `/data/fnb-assets/quarantine/`); `downloadUrl: null`; "Infected" badge, no download button |
| Oversize (normal) | 11 MB PNG, normal POST via nginx | ✅ 413 in 4 ms, 0 bytes uploaded — **but from nginx, not the app** (see F1). App-tier pre-buffer check verified separately by POSTing 11 MB directly to `storage-app:3000` inside the network → 413 `File too large` from the content-length pre-check |
| Oversize (chunked) | 11 MB, no content-length, direct to storage-app | ⚠️ Full body buffered (~774 ms), then 413 from the per-file check — **W5 confirmed exactly as predicted** at the app tier. Through nginx the chunked request is cut off at ~1 MB by the default cap (see F1), so the deployed topology accidentally mitigates W5 |
| Wrong type | `.exe` (`application/x-msdownload`), bare `application/zip` | ✅ 415 `Unsupported file type` (whitelist) for both |
| Type forgery | HTML bytes named `x.png` declared `image/png` | ✅ 415 `content bytes (unknown) do not match declared type image/png` (magic-byte sniff) |
| Anon posture | `publicAssetList(_id:)` clean-public / private / pending; `assetsList` | ✅ row / `[]` / `[]`; anon `assetsList` errors (masked, hash-logged). Public `downloadUrl` is direct unsigned (`/public/...` path) and anon `curl` of it returns 200 |
| Pending gate (public) | Anon query of a just-uploaded public asset | ✅ `[]` while `pending` — public assets are invisible until `clean` |
| Dashboard | Browsed `/graphql-api/workflow` as super-admin (Playwright) | ✅ All asset-scan runs listed: 6 COMPLETE (incl. the EICAR run) + 2 ERROR (the clamav-cold-boot workflows). Detail links present |
| Error path | **Not re-induced** (would require stopping clamav — env changes are user-run per house rule). Verified from the live trail instead | ✅ Asset `antififa.png` (12dfb3cc…): wf 1 errored 03:42 (clamav cold), reaper re-queued at exactly 04:00:00 and 04:15:00 (15-min cron), 3rd/final attempt **completed** with `scanVerdict: 'error'` + `scanError` recorded → `scan_status='error'`, bytes retained in quarantine, "Scan error" warning badge renders, no download button. Post-clamav-restart clean scans proven by 4 fresh uploads. **Plan A verified end-to-end in production conditions** |

## New findings

### F1 — HIGH: nginx default `client_max_body_size` (1 MB) blocks legitimate uploads
No `client_max_body_size` is set anywhere in `docker/nginx.conf`, so nginx enforces its 1 MB
default. A **5 MB PNG — well inside the spec's 10 MB limit — is rejected 413** by nginx (HTML
error page, never reaches the app). The 10 MB spec limit is unreachable through the proxy; only
sub-1 MB uploads work today. Every prior successful upload happened to be small.
**Fix:** `client_max_body_size 11m;` in the `/storage` location block (11 MB = app's
`MAX_BODY_BYTES` headroom). Side effect to keep in mind: this also removes the accidental nginx
mitigation of W5, making the app-tier chunked fix (Plan C §2) worth doing in the same change.

### Observations
- **W3 recorded:** the infected `eicar.txt` row remains visible in `/storage/assets`
  (Infected badge, no download) — matches the eval's recommended option (a) for the admin page,
  but the decision is still not codified in `_shared.data.md`, and `AssetsByOwningEntity` remains
  unfiltered.
- **M7 closed:** the "Asset Manager" nav tool is live in the Super Admin nav after the reseed.
- Rejected uploads (413/415) leave no DB row and no minio object — checked.

## Test artifacts left in the system
3 × `clean-test.txt` (2 private, 1 public, all clean/active), 1 × `eicar.txt`
(infected/deleted, object purged). Pre-existing: `big-buck.jpg` (clean), `antififa.png` (error,
bytes in quarantine).

## Verdict
**Phase 11 passes.** Every specced negative path behaves as designed, Plan A's error path is
verified from live evidence, and the security posture (pending gate, anon fetch-by-reference,
no enumeration) holds. One new infra defect (F1) needs a one-line nginx fix before any real-world
use — without it the feature effectively has a 1 MB upload limit.
