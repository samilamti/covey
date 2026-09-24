#!/usr/bin/env bash
# Step 13 — App Privacy ("nutrition label") instructions.
#
# Apple does NOT expose the App Privacy / Data Collection endpoints via the
# public App Store Connect API. Every candidate path (appDataUsages,
# appDataUsageCategories, appDataUsagePurposes, the *PublishState
# relationships) returns PATH_ERROR / undefined resource type. This is a
# genuine web-UI-only step; do not spend time re-probing it.
#
# The answers below are DERIVED FROM THE CODE, not chosen. Each one cites the
# file that proves it, so the declaration can be re-checked when the schema
# changes. Confirmed with Sami 2026-09-22.

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

1. Do you collect data from this app?  →  YES

2. Six data types. For EVERY one the answers are identical:
     Used for tracking?  NO
     Linked to the user? YES
     Purpose:            App Functionality (only)

   ▸ CONTACT INFO → Name
       BankID returns givenName + surname and both are stored on the
       users table (auth/providers/bankid.js, migrate.js). They are not
       shown to other users, who see the chosen display_name instead,
       but they ARE collected, and Apple asks about collection.

   ▸ LOCATION → Precise Location
       useGeolocation.js requests enableHighAccuracy: true, and
       location_updates stores NUMERIC(10,7) lat/lng + accuracy_m keyed
       to user_id. The ~111 m rounding in the privacy policy is
       ROUND(pickup_lat, 3) applied on the READ path for open listings
       only (repositories/requests.js); full precision is stored.
       A DB trigger purges location rows at terminal status. Good
       practice, but the data is still collected.

   ▸ IDENTIFIERS → User ID
       SHA-256 of the personnummer (users.nin_hash). The raw NIN is
       never persisted, only this hash plus the row's UUID.

   ▸ IDENTIFIERS → Device ID
       native_push_tokens (FCM token + platform) and push_subscriptions
       (Web Push endpoint). Also covers what Google receives via
       FirebaseMessaging / FirebaseInstallations.

   ▸ USER CONTENT → Other User Content
       session_messages.content (in-session chat),
       assistance_requests.message (free text on the request),
       and ratings.value.

   ▸ OTHER DATA → Other Data Types
       users.birth_year and users.sex, derived from the personnummer by
       auth/nin.js and used by services/demographics.js to gate the
       same_demographics eligibility tier. Apple's taxonomy has no age
       or gender bucket, so the catch-all is where these belong.

3. Explicitly NOT declared, each checked against the code:

   ▸ Health & Fitness      no health data anywhere in the schema or
                           handlers. Covey matches peers for walking and
                           holds no care-recipient or medical records.
   ▸ Sensitive Info        Apple's definition is racial or ethnic data,
                           sexual orientation, pregnancy, disability,
                           religious or philosophical belief, trade union
                           membership, political opinion, genetic,
                           biometric. Sex and gender are not on that
                           list; users.sex goes under Other Data Types.
   ▸ Email / Phone / Address   none exist. BankID is the only identity
                           channel.
   ▸ Diagnostics           no crash or analytics SDK. Podfile.lock has
                           FirebaseMessaging only, with no Analytics and
                           no Crashlytics.
   ▸ Usage Data            no product-interaction telemetry is sent.

4. Tracking is NO on every type, so App Tracking Transparency is not
   required and no ATT prompt should be added.

5. Note, and it changes nothing on the form: map tiles are fetched from
   tile.openstreetmap.org, so OSM's CDN sees the user's IP and the tile
   coordinates being viewed. Precise Location is already declared and
   the label has no finer setting to express this.

6. After Publish, the page header reads "Published … by <name>" and
   lists "6 data types collected from this app". Verify by reloading
   the page and reading the saved answers back; a form that looks
   filled is not the same as a form that saved.

   Editing an ALREADY-published label: the last screen of a new type's
   wizard carries a Publish button, not Save, so finishing the wizard
   publishes immediately. Published with all six types 2026-09-24.

══════════════════════════════════════════════════════════════
INSTRUCTIONS
