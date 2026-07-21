---
name: project-n8n-hardened-image
description: n8n 2.30.x images are Docker Hardened Images (Alpine, apk removed) — a custom n8n image adding binaries needs a multi-stage lib-copy, not `apk add`.
metadata:
  type: project
---

The pinned n8n image `docker.n8n.io/n8nio/n8n:2.30.7` (and Docker Hub `n8nio/n8n:2.30.7`) is a
**Docker Hardened Image**: Alpine 3.24 with **no package manager** (`apk` removed, exit 127). A
`RUN apk add …` in a custom Dockerfile FROM it fails.

**Custom-image pattern (verified 2026-07-20, agentic-decommission `docker/n8n/Dockerfile`):**
multi-stage build — install in a matching `alpine:3.24` builder, then copy the binaries + their
`ldd` shared-library closure into the hardened image, with `ENV LD_LIBRARY_PATH=/usr/local/lib`.
musl is ABI-stable across the same Alpine version, so the copied binaries run against the base
image's loader.

```dockerfile
FROM alpine:3.24 AS bins
RUN apk add --no-cache ffmpeg clamav-clamdscan
RUN mkdir -p /out/bin /out/lib && for b in /usr/bin/ffmpeg /usr/bin/clamdscan; do \
      cp -L "$b" /out/bin/; \
      ldd "$b" | awk '/=>/ {print $3}' | sort -u | while read -r l; do [ -f "$l" ] && cp -Ln "$l" /out/lib/ 2>/dev/null || true; done; \
    done
FROM docker.n8n.io/n8nio/n8n:2.30.7
USER root
COPY --from=bins /out/bin/ /usr/local/bin/
COPY --from=bins /out/lib/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib
USER node
```

Gotchas: clamdscan is the **`clamav-clamdscan`** Alpine package (NOT `clamav-clients` — that's the
Debian name). Verify the built image actually runs the binary (`ffmpeg -version`, `clamdscan
--config-file=… …`) — a passing `docker build` does not prove the lib closure is complete.

**Second n8n-2.x gotcha:** n8n 2.0 **disables the Execute Command node** (`n8n-nodes-base.executeCommand`)
and `localFileTrigger` by default — workflow activation fails with "Unrecognized node type:
n8n-nodes-base.executeCommand". Re-enable with env **`NODES_EXCLUDE=[]`** (empty list overrides
the default disable) on the n8n service. Only re-enable when the exec command is fixed workflow
JSON with no untrusted interpolation.

**Third n8n-2.x gotcha (file access):** n8n 2.x `SecurityConfig.restrictFileAccessTo` **defaults
to `~/.n8n-files`** — the Read/Write Binary File nodes reject any other path ("The file … is not
writable"), and n8n does NOT create the dir itself (`realpath ENOENT`). Write scan/temp files
under **`/home/node/.n8n-files/`** and pre-create it in the Dockerfile (`RUN mkdir -p
/home/node/.n8n-files && chown node:node …`) — the `n8n-data` volume only mounts `.n8n`, so the
dir must be baked into the image.

**Fourth gotcha (export shape for the repo/boot-import loop):** `n8n-cli workflow get --json` in
2.30.7 returns a **bloated** object (`shared`, `versionId`, `activeVersionId`, `sourceWorkflowId`,
`meta`, `staticData`, `tags`, `isArchived`, …). Committing that verbatim breaks the `n8n-import`
boot loop on a **fresh** `n8n_engine` with `insert or update on "workflow_entity" violates foreign
key constraint` (the `shared` project ref doesn't exist yet). **Strip exports to the minimal shape
the import loop accepts:** `{ id, name, active, nodes, connections, settings, pinData }` (match the
already-working repo workflows). Related: [[feedback_rebuild_ask_user]].
