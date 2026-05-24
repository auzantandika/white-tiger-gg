#!/usr/bin/env bash
set -euo pipefail

# White Tiger GG — first-time VPS setup for the live data cache service.
# Run locally from the project root (Git Bash on Windows is fine).

VPS_HOST="${VPS_HOST:-43.134.107.38}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-white-tiger-live-service}"
SERVICE_PORT="${SERVICE_PORT:-4000}"
PM2_NAME="${PM2_NAME:-white-tiger-live-service}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_SOURCE_DIR="${SCRIPT_DIR}/vps-live-service"
SSH_TARGET="${VPS_USER}@${VPS_HOST}"
SSH_OPTS=(-p "${VPS_PORT}" -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new)

echo "==> White Tiger GG VPS live service setup"
echo "    Target: ${SSH_TARGET}"
echo "    Remote dir: ~/${REMOTE_DIR}"
echo

if [[ ! -d "${SERVICE_SOURCE_DIR}" ]]; then
  echo "Missing service source directory: ${SERVICE_SOURCE_DIR}" >&2
  exit 1
fi

echo "==> Checking SSH access..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "echo 'SSH OK'"

echo "==> Installing system packages on VPS..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<'REMOTE_PACKAGES'
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y curl git nginx ufw ca-certificates gnupg

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

node -v
npm -v
pm2 -v
REMOTE_PACKAGES

echo "==> Creating remote app directory..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "mkdir -p ~/${REMOTE_DIR}/data"

echo "==> Copying service files to VPS..."
scp "${SCP_OPTS[@]}" -r \
  "${SERVICE_SOURCE_DIR}/package.json" \
  "${SERVICE_SOURCE_DIR}/server.js" \
  "${SERVICE_SOURCE_DIR}/.env.example" \
  "${SERVICE_SOURCE_DIR}/lib" \
  "${SSH_TARGET}:~/${REMOTE_DIR}/"

echo "==> Creating .env on VPS if missing..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<REMOTE_ENV
set -euo pipefail
cd ~/${REMOTE_DIR}
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created ~/${REMOTE_DIR}/.env from .env.example"
  echo "Edit it on the VPS before relying on protected endpoints."
else
  echo ".env already exists — leaving it unchanged"
fi
REMOTE_ENV

echo "==> Installing npm dependencies and starting PM2..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<REMOTE_APP
set -euo pipefail
cd ~/${REMOTE_DIR}
npm install
pm2 delete ${PM2_NAME} >/dev/null 2>&1 || true
pm2 start server.js --name ${PM2_NAME}
pm2 save
REMOTE_APP

echo "==> Configuring PM2 startup and firewall..."
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "bash -s" <<REMOTE_FINAL
set -euo pipefail

STARTUP_CMD=\$(pm2 startup systemd -u ${VPS_USER} --hp "/home/${VPS_USER}" | tail -n 1 || true)
if [[ -n "\${STARTUP_CMD}" ]]; then
  eval "\${STARTUP_CMD}" || true
fi
pm2 save

sudo ufw allow OpenSSH
sudo ufw allow ${SERVICE_PORT}/tcp
echo "y" | sudo ufw enable || true
sudo ufw status
REMOTE_FINAL

cat <<EOF

Setup complete.

Next steps on the VPS:
  1. SSH in:
     ssh -p ${VPS_PORT} ${SSH_TARGET}

  2. Edit secrets (do not paste them into chat):
     nano ~/${REMOTE_DIR}/.env
     Set:
       LIVE_DATA_API_TOKEN=PASTE_RANDOM_TOKEN_HERE
       YOUTUBE_API_KEY=PASTE_YOUTUBE_API_KEY_HERE

  3. Restart the service:
     pm2 restart ${PM2_NAME}

Test URLs:
  http://${VPS_HOST}:${SERVICE_PORT}/health
  http://${VPS_HOST}:${SERVICE_PORT}/live-data

Manual scan (after setting LIVE_DATA_API_TOKEN):
  curl -X POST "http://${VPS_HOST}:${SERVICE_PORT}/scan-now?token=PASTE_RANDOM_TOKEN_HERE"

EOF
