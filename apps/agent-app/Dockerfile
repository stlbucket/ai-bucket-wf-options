FROM node:22-alpine

# ffmpeg for asset-scan thumbnailing + clamav-clamdscan (Alpine's clamdscan package — the spec's
# `clamav-clients` is the Debian name) for streaming scans against the clamav service — inherited
# from the retired worker-app image precedent. Both binaries run as child processes INSIDE tool
# handlers only (server/lib/agent-tools/); the model has no execute tool.
RUN apk add --no-cache ffmpeg clamav-clamdscan

COPY apps/agent-app/clamd-remote.conf /etc/clamav/clamd-remote.conf

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

EXPOSE 3000
