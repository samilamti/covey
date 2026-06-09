#!/usr/bin/env bash
# Run the Android build (+ publish, if API access is configured) end-to-end.
#   00→03 always run (prereqs, Firebase config, keystore, signed AAB).
#   04→05 run only when PLAY_SA_JSON is present (Play Console API access set up).

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

./00-prereqs.sh
./01-firebase-config.sh
./02-keystore.sh
./03-build-aab.sh

if [[ -f "${PLAY_SA_JSON:-}" ]]; then
  ./04-play-listing.sh
  ./05-upload-aab.sh
  echo
  echo "🎉 Built and uploaded to the '${TRACK:-alpha}' track. Finish in Play Console:"
  echo "   content rating, Data safety, target audience, testers → Send for review."
else
  echo
  echo "✅ Signed AAB built: $AAB_PATH"
  echo "ℹ️  Publish steps skipped — no PLAY_SA_JSON yet."
  echo "   Set up Play Console API access (see README.md), then rerun ./all.sh."
fi
