#!/bin/bash
# Deploy Picasso to one Google Compute Engine VM.
#
#   deploy/gcp-vm.sh create    # static IP, firewall, VM, settings, first start (~10 min)
#   deploy/gcp-vm.sh update    # pull the latest code from GitHub and rebuild
#   deploy/gcp-vm.sh env       # re-upload settings (allowlist, invite code, keys) and restart
#   deploy/gcp-vm.sh status    # containers and the site address
#   deploy/gcp-vm.sh logs      # follow the API logs
#   deploy/gcp-vm.sh ssh
#
# Overrides: PROJECT, ZONE (us-central1-a), NAME (picasso), MACHINE (e2-standard-2), DISK_GB (50),
# DOMAIN (default <ip>.sslip.io), CLAUDE_ACCOUNT_ALLOWLIST, INVITE_CODE.
set -euo pipefail

# gcloud from PATH, or the per-user install in ~/google-cloud-sdk.
command -v gcloud >/dev/null || export PATH="$HOME/google-cloud-sdk/bin:$PATH"
command -v gcloud >/dev/null || { echo "Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install"; exit 1; }

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
ZONE=${ZONE:-us-central1-a}
REGION=${ZONE%-*}
NAME=${NAME:-picasso}
MACHINE=${MACHINE:-e2-standard-2}
DISK_GB=${DISK_GB:-50}
[ -n "$PROJECT" ] || { echo "Set a project: gcloud config set project <id>"; exit 1; }
G="gcloud --project=$PROJECT --quiet"

ip() { $G compute addresses describe "$NAME-ip" --region="$REGION" --format='value(address)'; }
on_vm() { $G compute ssh "$NAME" --zone="$ZONE" --command="$1"; }

# Settings file for the server. Kept outside git: it holds the invite code and API keys.
write_env() {
  local env_file=$HERE/.env domain=${DOMAIN:-$(ip | tr . -).sslip.io}
  local invite=${INVITE_CODE:-$(grep -s '^PICASSO_INVITE_CODE=' "$env_file" | cut -d= -f2- || true)}
  [ -n "$invite" ] || invite=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 10)
  local allow=${CLAUDE_ACCOUNT_ALLOWLIST:-$(grep -s '^PICASSO_CLAUDE_ACCOUNT_ALLOWLIST=' "$env_file" | cut -d= -f2- || true)}
  local keys=$(grep -sE '^(PIXABAY_API_KEY|PEXELS_API_KEY)=' "$ROOT/backend/.env" || true)
  umask 077
  printf 'PICASSO_DOMAIN=%s\nPICASSO_CLAUDE_ACCOUNT_ALLOWLIST=%s\nPICASSO_INVITE_CODE=%s\n%s\n' \
    "$domain" "$allow" "$invite" "$keys" > "$env_file"
  echo "Settings written to deploy/.env (domain $domain, invite code $invite)"
}

upload_env() {
  $G compute scp "$HERE/.env" "$NAME:/tmp/picasso.env" --zone="$ZONE"
  on_vm 'sudo install -m 600 /tmp/picasso.env /etc/picasso.env && rm /tmp/picasso.env'
}

case "${1:-}" in
  create)
    $G services enable compute.googleapis.com
    $G compute addresses describe "$NAME-ip" --region="$REGION" >/dev/null 2>&1 \
      || $G compute addresses create "$NAME-ip" --region="$REGION"
    $G compute firewall-rules describe "$NAME-web" >/dev/null 2>&1 \
      || $G compute firewall-rules create "$NAME-web" --allow=tcp:80,tcp:443 --target-tags="$NAME"
    write_env
    $G compute instances create "$NAME" --zone="$ZONE" --machine-type="$MACHINE" \
      --image-family=debian-12 --image-project=debian-cloud \
      --boot-disk-size="${DISK_GB}GB" --boot-disk-type=pd-balanced \
      --address="$(ip)" --tags="$NAME" \
      --metadata-from-file=startup-script="$HERE/vm-startup.sh"
    echo "Waiting for the VM to accept SSH…"
    until on_vm true >/dev/null 2>&1; do sleep 10; done
    upload_env
    echo "Building and starting Picasso on the VM (first build takes several minutes)…"
    on_vm 'until sudo grep -q "== picasso up" /var/log/picasso-startup.log 2>/dev/null; do sleep 15; done'
    echo "Picasso is live at https://$(grep '^PICASSO_DOMAIN=' "$HERE/.env" | cut -d= -f2)"
    ;;
  update)
    on_vm 'cd /opt/picasso && sudo git pull --ff-only && cd deploy && sudo docker compose up -d --build --remove-orphans && sudo docker image prune -f'
    ;;
  env)
    write_env
    upload_env
    on_vm 'cd /opt/picasso/deploy && sudo install -m 600 /etc/picasso.env .env && sudo docker compose up -d'
    ;;
  status)
    on_vm 'cd /opt/picasso/deploy && sudo docker compose ps'
    echo "https://$(grep -s '^PICASSO_DOMAIN=' "$HERE/.env" | cut -d= -f2)"
    ;;
  logs) on_vm 'cd /opt/picasso/deploy && sudo docker compose logs -f --tail=100 backend' ;;
  ssh) $G compute ssh "$NAME" --zone="$ZONE" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
