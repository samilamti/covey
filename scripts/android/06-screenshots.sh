#!/usr/bin/env bash
# Step 06 — Capture Play Store phone screenshots from an emulator (best-effort).
#
# Uses the demo easter egg (type the magic NIN 999999999999 into the field →
# signs in as the deterministic demo persona, mint theme). adb text injection is
# deterministic; only the initial field-focus tap is coordinate-based, computed
# as a fraction of the live screen size so it's resolution-independent.
#
# Output: build/android/screenshots/NN-*.png

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SDK="$(android_sdk)"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"
AVD="${SCREENSHOT_AVD:-Medium_Phone}"
OUT="$BUILD_DIR/screenshots"
APK="$ANDROID_PROJECT/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p "$OUT"

command -v "$ADB" >/dev/null 2>&1 || { err "adb not found at $ADB"; exit 1; }

log "Building debug APK (web assets + assembleDebug)..."
( cd "$FRONTEND_DIR" && npm run build >/dev/null && npx cap sync android >/dev/null )
( cd "$ANDROID_PROJECT" && ./gradlew assembleDebug --console=plain >/dev/null )
[[ -f "$APK" ]] || { err "debug APK not found at $APK"; exit 1; }
ok "APK built"

if ! "$ADB" devices | grep -q "emulator-"; then
  log "Booting emulator $AVD..."
  "$EMU" -avd "$AVD" -no-snapshot -no-boot-anim >/dev/null 2>&1 &
  "$ADB" wait-for-device
  # wait for full boot
  until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 2; done
fi
ok "Emulator ready"

read -r SW SH < <("$ADB" shell wm size | sed -E 's/.*: ([0-9]+)x([0-9]+).*/\1 \2/')
tap() { "$ADB" shell input tap "$1" "$2"; }
shot() { sleep 1.5; "$ADB" exec-out screencap -p > "$OUT/$1.png"; ok "  captured $1.png"; }

log "Installing + launching..."
"$ADB" install -r -g "$APK" >/dev/null
"$ADB" shell am start -n "$PACKAGE_NAME/.MainActivity" >/dev/null
sleep 6
shot "01-landing"

log "Triggering demo persona via magic NIN..."
# Focus the NIN input (~69% down the screen, centered), type the magic value,
# dismiss the keyboard, then tap the login button (~75%). Requires a backend that
# completes stub auth — point at the local stack (not production) to avoid
# creating real rows. The demo trigger flips the theme to mint on success.
tap $((SW*50/100)) $((SH*69/100)); sleep 1
"$ADB" shell input text "999999999999"; sleep 1
"$ADB" shell input keyevent 4     # dismiss soft keyboard
sleep 1
tap $((SW*50/100)) $((SH*75/100)) # "Logga in med BankID"
sleep 10
shot "02-requests"

# Walk the bottom-nav tabs (evenly spaced along the bottom bar).
NAV_Y=$((SH*96/100))
for i in 1 2 3 4; do
  tap $(( SW*(2*i-1)/8 )) "$NAV_Y"; sleep 1
  shot "0$((i+2))-tab$i"
done

log "Done. Review $OUT and keep the best 2–8 for the listing (≥320px, 16:9 or 9:16)."
ok "Screenshots in $OUT"
