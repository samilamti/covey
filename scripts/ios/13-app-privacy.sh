#!/usr/bin/env bash
# Step 13 — App Privacy ("nutrition label") instructions.
#
# Apple does NOT expose the App Privacy / Data Collection endpoints via the
# public App Store Connect API. This must be done in the web UI.
# This script prints the exact answers to enter, derived from the codebase:
#   - NIN hash (sha256) stored in users.id mapping → identifier
#   - Push tokens stored in push_subscriptions / native_push_tokens
#   - Live location during active sessions (ephemeral, deleted on session end)
#   - In-session messages between matched users
#   - Display name (pseudonym) chosen by user

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

APP_ID=$(cat "$BUILD_DIR/app-resource-id.txt")

cat <<INSTRUCTIONS
══════════════════════════════════════════════════════════════
App Privacy — manual web UI step (API does not expose this)
══════════════════════════════════════════════════════════════

URL: https://appstoreconnect.apple.com/apps/$APP_ID/distribution/privacy

Click "Get Started" or "Edit" then answer:

1. Do you collect data from this app?  →  YES

2. Select all data types collected. Check ONLY these:

   ▸ CONTACT INFO
     ▸ Name (the pseudonymous display name users choose)
       □ Used for tracking? NO
       ☑ Linked to user? YES
       Purposes: ☑ App Functionality
                 (no analytics / advertising / personalization)

   ▸ LOCATION
     ▸ Precise Location (live coordinates during active walking session)
       □ Used for tracking? NO
       ☑ Linked to user? YES
       Purposes: ☑ App Functionality

   ▸ IDENTIFIERS
     ▸ User ID (SHA-256 hash of Swedish national ID number)
       □ Used for tracking? NO
       ☑ Linked to user? YES
       Purposes: ☑ App Functionality

     ▸ Device ID (push notification tokens — APNs/FCM)
       □ Used for tracking? NO
       ☑ Linked to user? YES
       Purposes: ☑ App Functionality

   ▸ USER CONTENT
     ▸ Other User Content (in-session chat messages between paired users)
       □ Used for tracking? NO
       ☑ Linked to user? YES
       Purposes: ☑ App Functionality

   ▸ DIAGNOSTICS
     (skip — Covey does not collect crash reports or analytics in v1.0)

3. After saving, the App Privacy section will show "Ready to Submit".

Why each choice:
  • Tracking = NO   → covey.se never builds advertising profiles, no
                       third-party analytics SDKs, no IDFA usage.
  • Linked to user  → all data is tied to the user's UUID/NIN-hash,
                       not anonymous.
  • App functionality only — no analytics, no personalization, no ads.

══════════════════════════════════════════════════════════════
INSTRUCTIONS
