#!/usr/bin/env bash
# Run the full iOS deployment pipeline end-to-end.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd "$SCRIPT_DIR"

./00-prereqs.sh
./01-install-and-build.sh
./02-configure-xcode-project.sh
./03-register-bundle-id.sh
./04-create-asc-app.sh
./05-archive.sh
./06-export-ipa.sh
./07-upload-testflight.sh

echo
echo "🎉 Pipeline complete. Build will appear in TestFlight in ~10 minutes."
