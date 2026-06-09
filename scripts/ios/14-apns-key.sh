#!/usr/bin/env bash
# Step 14 — APNs Auth Key creation (manual web UI step + Firebase wiring).
#
# Apple does NOT expose APNs Auth Keys via the App Store Connect API.
# This script prints the exact steps to create the key in the Apple Developer
# Portal and plug it into Firebase Cloud Messaging — which the backend's
# notifications service uses to deliver pushes to iOS devices.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

cat <<INSTRUCTIONS
══════════════════════════════════════════════════════════════
APNs Auth Key — manual setup
══════════════════════════════════════════════════════════════

iOS push notifications need a separate "APNs Auth Key" .p8 file
(distinct from the App Store Connect API key we already use).
Apple's API does not expose this; create it in the web UI, then
plug it into Firebase Cloud Messaging (FCM).

──────────────────────────────────────────────────────────────
PART 1 — Create the APNs key (Apple Developer Portal)
──────────────────────────────────────────────────────────────

1. Open https://developer.apple.com/account/resources/authkeys/list
2. Click "+" (top-left) to create a new key
3. Name: 'Covey APNs'
4. Tick: ☑ Apple Push Notifications service (APNs)
5. Configure → leave default ('Production & Development', all topics)
6. Continue → Register → Download (only once!)
7. Note:
   • Key ID (10 chars) — printed on the page
   • Team ID: $ASC_TEAM_ID
   • The downloaded .p8 file (e.g. AuthKey_ABC123XYZ.p8)

──────────────────────────────────────────────────────────────
PART 2 — Wire into Firebase (FCM bridges APNs for iOS)
──────────────────────────────────────────────────────────────

1. Open https://console.firebase.google.com
2. Select (or create) the Firebase project for Covey
3. Add an iOS app if not yet:
   • Bundle ID: $APP_BUNDLE_ID
   • App nickname: Covey iOS
   • Download GoogleService-Info.plist → place in
     frontend/ios/App/App/GoogleService-Info.plist (and re-run cap sync)
4. Project Settings → Cloud Messaging tab → "Apple app configuration"
5. Click "Upload" under APNs Authentication Key:
   • Key ID:   <from Part 1>
   • Team ID:  $ASC_TEAM_ID
   • APNs key: upload the .p8 from Part 1
6. Confirm → Firebase shows "Authentication Key configured"

──────────────────────────────────────────────────────────────
PART 3 — Firebase service account → backend
──────────────────────────────────────────────────────────────

The backend needs Firebase Admin credentials to call FCM:

1. Firebase Console → Project Settings → Service accounts
2. "Generate new private key" → download <project>-firebase-adminsdk-XYZ.json
3. Compress to one line:
     cat <project>-firebase-adminsdk-XYZ.json | jq -c .
4. Set on the production backend host as the env var:
     FIREBASE_SERVICE_ACCOUNT='<one-line JSON>'
5. Restart the backend Docker stack:
     docker compose --env-file .env.prod up -d backend

──────────────────────────────────────────────────────────────
PART 4 — Verify end-to-end
──────────────────────────────────────────────────────────────

1. Install the TestFlight build on a real iPhone (not simulator —
   APNs doesn't deliver to simulators)
2. Log in once → app should call POST /api/notifications/subscribe-native
   (verify in backend logs)
3. From a second account, create an assistance request near the first
   account → notifyNewRequest fires → push arrives on iPhone.

══════════════════════════════════════════════════════════════
INSTRUCTIONS
