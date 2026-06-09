#!/usr/bin/env bash
# Step 12 — Set age rating declaration: 4+ (no objectionable content).
# `unrestrictedWebAccess: false` since the app embeds OSM map tiles only,
# not arbitrary web pages. Messaging is between paired users only.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

APP_INFO_ID=$(cat "$BUILD_DIR/app-info-id.txt")
PY="$SCRIPT_IOS_DIR/.venv/bin/python3"

# The ageRatingDeclaration shares its ID with the appInfo
DECL_ID="$APP_INFO_ID"

log "Setting age rating declaration to 4+ (all NONE, no gambling/violence/etc)..."

BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'ageRatingDeclarations',
    'id': '$DECL_ID',
    'attributes': {
      # ENUMs (NONE | INFREQUENT_OR_MILD | FREQUENT_OR_INTENSE)
      'alcoholTobaccoOrDrugUseOrReferences': 'NONE',
      'contests': 'NONE',
      'gamblingSimulated': 'NONE',
      'gunsOrOtherWeapons': 'NONE',
      'horrorOrFearThemes': 'NONE',
      'matureOrSuggestiveThemes': 'NONE',
      'profanityOrCrudeHumor': 'NONE',
      'sexualContentGraphicAndNudity': 'NONE',
      'sexualContentOrNudity': 'NONE',
      'violenceCartoonOrFantasy': 'NONE',
      'violenceRealistic': 'NONE',
      'violenceRealisticProlongedGraphicOrSadistic': 'NONE',
      # Booleans
      'gambling': False,
      'lootBox': False,
      'parentalControls': False,
      'unrestrictedWebAccess': False,
      'userGeneratedContent': False,
      # The app uses session-based chat between paired users
      'messagingAndChat': True,
      'medicalOrTreatmentInformation': 'NONE',
      'healthOrWellnessTopics': False,
      'advertising': False,
      'ageAssurance': False,
      'kidsAgeBand': None,
    }
  }
}))
")

asc_patch "/ageRatingDeclarations/$DECL_ID" "$BODY" >/dev/null
ok "Age rating set"
