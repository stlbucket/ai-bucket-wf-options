# Custom n8n image for the fnb workflow engine (spec: .claude/specs/agentic-decommission/
# infrastructure.md). The asset-scan workflow's Execute Command nodes need binaries the stock
# image lacks: clamdscan (--stream to the clamav container) and ffmpeg (256px webp thumbnails).
#
# The n8n 2.30.7 image is a Docker Hardened Image (Alpine 3.24 with apk removed), so we cannot
# `apk add` into it. Instead, install the binaries in a matching Alpine builder and copy them
# plus their full shared-library closure into the hardened image. musl is ABI-stable across the
# same Alpine version, so binaries built on alpine:3.24 run against the base image's own loader.

FROM alpine:3.24 AS bins
# clamdscan is provided by clamav-clamdscan on Alpine (NOT clamav-clients — that was the Debian
# name in the superseded draft).
RUN apk add --no-cache ffmpeg clamav-clamdscan
RUN mkdir -p /out/bin /out/lib \
 && for b in /usr/bin/ffmpeg /usr/bin/clamdscan; do \
      cp -L "$b" /out/bin/; \
      ldd "$b" | awk '/=>/ { print $3 }' | sort -u | while read -r lib; do \
        [ -f "$lib" ] && cp -Ln "$lib" /out/lib/ 2>/dev/null || true; \
      done; \
    done

FROM docker.n8n.io/n8nio/n8n:2.30.7
USER root
COPY --from=bins /out/bin/ /usr/local/bin/
COPY --from=bins /out/lib/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib
# clamdscan talks TCP to the `clamav` compose service (no local clamd in this image).
COPY clamd-remote.conf /etc/clamav/clamd-remote.conf
# asset-scan writes the scan file here: n8n 2.x restricts file access to ~/.n8n-files by default
# (SecurityConfig.restrictFileAccessTo), and n8n won't create the dir itself (realpath ENOENT).
RUN mkdir -p /home/node/.n8n-files && chown node:node /home/node/.n8n-files
USER node
