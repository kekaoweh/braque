#!/bin/bash
# Runs as root on every boot of the Picasso VM (Google Compute Engine startup script).
# First boot: swap, Docker, clone. Every boot: pull the latest code and (re)start the stack.
set -euo pipefail
exec > >(tee -a /var/log/picasso-startup.log) 2>&1
echo "== picasso startup $(date -Is)"

REPO=https://github.com/kekaoweh/picasso.git
DIR=/opt/picasso

if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  apt-get update && apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -d "$DIR/.git" ]; then
  git clone "$REPO" "$DIR"
else
  git -C "$DIR" pull --ff-only || echo "git pull failed; starting the code already on disk"
fi

# deploy/.env is uploaded by gcp-vm.sh to /etc/picasso.env (root-only); wait for it on first boot.
for _ in $(seq 1 120); do [ -f /etc/picasso.env ] && break; sleep 5; done
install -m 600 /etc/picasso.env "$DIR/deploy/.env"

cd "$DIR/deploy"
docker compose up -d --build --remove-orphans
docker image prune -f
echo "== picasso up"
