#!/usr/bin/env bash
set -euo pipefail

# White Tiger GG — deploy/update the VPS live data cache service.
# Run locally from the project root (Git Bash on Windows is fine).

VPS_HOST="${VPS_HOST:-43.134.107.38}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-white-tiger-live-service}"
PM2_NAME="${PM2_NAME:-white-tiger-live-service}"
SERVICE_PORT="${SERVICE_PORT:-4000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SOURCE_DIR="${SCRIPT_DIR}/vps-live-service"
SSH_TARGET="${VPS_USER}@${VPS_HOST}"
SSH_OPTS=(-p "${VPS_PORT}" -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new)

echo "==> Deploying White Tiger GG live service to ${SSH_TARGET}:${VPS_PORT}"
echo

if [[ ! -d "${SERVICE_SOURCE_DIR}" ]]; then
  echo "Missing service source directory: ${SERVICE_SOURCE_DIR}" >&2
  exit 1
fi

echo "==> Checking SSH access..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "echo 'SSH OK'"

echo "==> Ensuring remote directory exists..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "mkdir -p ~/${REMOTE_DIR}/data"

echo "==> Copying service files (remote .env is preserved)..."
scp "${SCP_OPTS[@]}" -r \
  "${SERVICE_SOURCE_DIR}/server.js" \
  "${SERVICE_SOURCE_DIR}/package.json" \
  "${SERVICE_SOURCE_DIR}/package-lock.json" \
  "${SERVICE_SOURCE_DIR}/.env.example" \
  "${SERVICE_SOURCE_DIR}/debug-channel.js" \
  "${SERVICE_SOURCE_DIR}/validate-streamers.js" \
  "${SERVICE_SOURCE_DIR}/lib" \
  "${SSH_TARGET}:~/${REMOTE_DIR}/"

echo "==> Installing dependencies and restarting PM2..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<REMOTE_DEPLOY
set -euo pipefail
cd ~/${REMOTE_DIR}
npm install --omit=dev
pm2 restart ${PM2_NAME} --update-env || pm2 start server.js --name ${PM2_NAME}
pm2 save
pm2 status ${PM2_NAME}
REMOTE_DEPLOY

echo "==> Verifying health endpoint on VPS..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "curl -s http://localhost:${SERVICE_PORT}/health"

echo
echo "==> Verifying streamers module on VPS..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<'REMOTE_VERIFY'
set -euo pipefail
cd ~/white-tiger-live-service
ls lib
node -e "const m=require('./lib/streamers.js'); console.log(m.STREAMER_CHANNELS.length)"
REMOTE_VERIFY

cat <<EOF

Deploy complete.

Test URLs:
  http://${VPS_HOST}:${SERVICE_PORT}/health
  http://${VPS_HOST}:${SERVICE_PORT}/live-data

EOF
