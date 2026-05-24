#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-43.134.107.38}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_PORT="${VPS_PORT:-22}"
SSH_TARGET="${VPS_USER}@${VPS_HOST}"

echo "==> Triggering manual scan on VPS (token read from remote .env)..."

ssh -p "${VPS_PORT}" -o StrictHostKeyChecking=accept-new "${SSH_TARGET}" bash <<'REMOTE'
set -euo pipefail
cd ~/white-tiger-live-service
TOKEN="$(grep '^LIVE_DATA_API_TOKEN=' .env | cut -d= -f2- | tr -d '\r' | xargs)"
echo "Starting scan (this may take 1-2 minutes)..."
curl -s -X POST "http://localhost:4000/scan-now?token=${TOKEN}"
echo
REMOTE

echo "==> Done."
