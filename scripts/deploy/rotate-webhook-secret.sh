#!/usr/bin/env bash
# Rotate DEPLOY_WEBHOOK_SECRET: the HMAC key shared by the GitHub Actions
# `deploy` job and the box's webhook container.
#
# Usage:
#   scripts/deploy/rotate-webhook-secret.sh            # rotate + verify
#   scripts/deploy/rotate-webhook-secret.sh --no-rerun # skip the Actions re-run
#
# Env overrides (current values are the defaults):
#   PROD_SSH   deploy@46.246.48.39
#   APP_DIR    /home/deploy/apps/tillsammans
#   GH_REPO    samilamti/covey
#
# Needs: the deploy key in ssh-agent
#   (ssh-add --apple-use-keychain ~/.ssh/covey_deploy), and `gh` logged in.
#
# What it does:
#   1. On the box: back up .env.prod, generate a new 64-hex value, rewrite
#      only that line (asserting every other line is unchanged), recreate the
#      webhook container (`restart` would NOT reload env), check the container
#      holds the new value, and check a request signed with the OLD value is
#      refused. The backup is removed once those pass.
#   2. Pipes the new value from the box straight into `gh secret set`, so it
#      never appears in a terminal, a file on this Mac, or any argv.
#   3. Re-runs the deploy job of the latest main run, which proves the GitHub
#      side signs correctly. That redeploys the current commit (harmless).
#
# WHY: rotate after anything else may have held the key. The 2026-10-05
# Codeberg -> GitHub move found Woodpecker still alive with a working copy.
#
# Status: transcribed from the rotation run by hand on 2026-10-05 (proven end
# to end then); this script as a whole has not been run yet.
set -euo pipefail

PROD_SSH="${PROD_SSH:-deploy@46.246.48.39}"
APP_DIR="${APP_DIR:-/home/deploy/apps/tillsammans}"
GH_REPO="${GH_REPO:-samilamti/covey}"
RERUN=1
[ "${1:-}" = "--no-rerun" ] && RERUN=0

echo "== 1/3 rotating on the box"
# Script goes over stdin; APP_DIR is passed as an argument, the value never is.
ssh "$PROD_SSH" "bash -s -- '$APP_DIR'" <<'REMOTE'
set -euo pipefail
cd "$1"
umask 077
ts=$(date -u +%Y%m%dT%H%M%SZ)
bak=".env.prod.bak-$ts"
cp -p .env.prod "$bak"

old=$(grep '^DEPLOY_WEBHOOK_SECRET=' .env.prod | cut -d= -f2- | tr -d '\r\n')
new=$(openssl rand -hex 32)
[ "${#new}" -eq 64 ] || { echo "bad new secret"; exit 1; }

awk -v v="$new" '/^DEPLOY_WEBHOOK_SECRET=/{print "DEPLOY_WEBHOOK_SECRET=" v; next} {print}' .env.prod > .env.prod.tmp
[ "$(grep -c '^DEPLOY_WEBHOOK_SECRET=' .env.prod.tmp)" -eq 1 ] || { rm -f .env.prod.tmp; echo "key count wrong"; exit 1; }
diff <(grep -v '^DEPLOY_WEBHOOK_SECRET=' "$bak") <(grep -v '^DEPLOY_WEBHOOK_SECRET=' .env.prod.tmp) >/dev/null \
  || { rm -f .env.prod.tmp; echo "other lines changed, aborting"; exit 1; }
chmod 600 .env.prod.tmp
mv .env.prod.tmp .env.prod

docker compose -p tillsammans --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps webhook
sleep 4

[ "$(docker exec tillsammans-webhook-1 printenv DEPLOY_WEBHOOK_SECRET)" = "$new" ] \
  || { echo "container does not hold the new value; backup kept at $bak"; exit 1; }
echo "container holds the new value"

body='{"ref":"main","trigger":"rotation-check"}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$old" | awk '{print $2}')
resp=$(curl -sS -X POST -H 'Content-Type: application/json' \
  -H "X-Webhook-Signature: sha256=$sig" -d "$body" https://covey.se/hooks/deploy)
[ "$resp" != "Deploy triggered" ] || { echo "OLD secret still accepted; backup kept at $bak"; exit 1; }
echo "old secret refused: $resp"
rm -f "$bak"
REMOTE

echo "== 2/3 updating the GitHub repo secret"
ssh -n "$PROD_SSH" "grep '^DEPLOY_WEBHOOK_SECRET=' '$APP_DIR/.env.prod' | cut -d= -f2- | tr -d '\r\n'" \
  | gh secret set DEPLOY_WEBHOOK_SECRET --repo "$GH_REPO"
gh secret list --repo "$GH_REPO" | grep DEPLOY_WEBHOOK_SECRET

if [ "$RERUN" -eq 0 ]; then
  echo "== 3/3 skipped (--no-rerun); the next push to main is the GitHub-side test"
  exit 0
fi

echo "== 3/3 re-running the latest main deploy job"
run=$(gh run list --repo "$GH_REPO" --branch main --event push --status success --limit 1 --json databaseId -q '.[0].databaseId')
job=$(gh run view "$run" --repo "$GH_REPO" --json jobs -q '.jobs[] | select(.name=="Deploy to covey.se") | .databaseId')
gh run rerun "$run" --repo "$GH_REPO" --job "$job"
sleep 15
gh run watch "$run" --repo "$GH_REPO" --interval 10 --exit-status >/dev/null || true
concl=$(gh run view "$run" --repo "$GH_REPO" --json jobs -q '.jobs[] | select(.name=="Deploy to covey.se") | .conclusion')
echo "deploy job: $concl"
[ "$concl" = "success" ] || { echo "GitHub-side deploy failed: check the secret"; exit 1; }
echo "Done. Confirm on the box: docker logs tillsammans-webhook-1 | grep 'Deploy finished'"
