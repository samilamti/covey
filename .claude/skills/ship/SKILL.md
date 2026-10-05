---
name: ship
description: End-of-session ship routine — verify (full backend+frontend tests AND an interactive iOS Simulator smoke test), then commit to main, push to GitHub (deploys via Actions), and upload to TestFlight ONLY when iOS-bundled code changed. Run at the end of every successful work session — when Sami signals wrap-up ("done for today", "wrap up", "ship it", "archive") or when asked to commit-and-ship. This is a Claude-run routine, not a hook: the "successful session" gate requires judgment (tests + a hands-on simulator check) the harness cannot perform.
---

Standing reflex (Sami's instruction, 2026-06-17): at the end of each **successful** session,
commit to `main`, push, and ship to TestFlight when iOS changed. "Successful" is gated on
BOTH automated tests passing AND your own interactive simulator smoke test. Do NOT ship on a
session that didn't reach a clean, verified state — report why and stop instead.

Run the steps in order. Do not skip a gate.

## Gate A — full test suites (must be 100% green)

```bash
cd backend  && npm test    # node:test (107)
cd frontend && npm test    # vitest (191)
```

If anything fails, STOP. Fix it or tell Sami what's red — do not commit a failing tree.

## Gate B — interactive iOS Simulator smoke test (on Sami's Mac)

Build the app and run it in the Simulator, then verify the screens this session touched
actually work — don't just trust the unit tests.

```bash
# CocoaPods 1.16 + Ruby 4.x crash with "Unicode Normalization not appropriate for
# ASCII-8BIT" unless the locale is UTF-8. The pipeline's lib/common.sh sets this for
# Step 5, but a direct `cap sync` here does NOT — export it yourself:
export LANG="en_US.UTF-8" LC_ALL="en_US.UTF-8"
cd frontend && npm run build && npx cap sync ios

# Boot the 6.7" simulator (matches our screenshot size) + open the GUI:
xcrun simctl boot "iPhone 16 Plus" 2>/dev/null || true
open -a Simulator

# Cap 7 uses CocoaPods → build the WORKSPACE (NOT the .xcodeproj), scheme "App".
# Simulator builds are unsigned, so no signing/profile needed:
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath /tmp/covey-sim \
  -destination 'platform=iOS Simulator,name=iPhone 16 Plus' \
  build > /tmp/covey-build.log 2>&1; echo "EXIT=$?"; tail -5 /tmp/covey-build.log

xcrun simctl install booted "$(find /tmp/covey-sim/Build/Products/Debug-iphonesimulator -maxdepth 1 -name 'App.app' | head -1)"
xcrun simctl launch booted se.covey.app
xcrun simctl io booted screenshot /tmp/covey-sim-shot.png   # then Read it
```

NOTE on scope: native `API_BASE` points at production (`covey.se`), and driving the stub
login on the simulator needs flaky coordinate automation. So for **pure web-layer UI changes**
(CSS/markup/icons already verified in the web preview, which wraps the identical `dist/`
bundle), a native **boot-and-render** check of the affected screens is sufficient — don't
rabbit-hole into login automation. Only stand up a local backend / drive a logged-in flow when
a change is native-specific or genuinely can't be judged from the landing render + preview.

Verify, with screenshots (`simctl io booted screenshot` → Read), that:
- The app boots without a crash (check `xcrun simctl spawn booted log stream --predicate 'process == "App"'` briefly if unsure).
- The landing/login screen renders correctly.
- **The specific screens/flows changed this session look right.** For logged-in screens, use
  the demo easter-egg (double-tap the Covey logo → login) rather than a real BankID flow.

GOTCHA: iOS Simulator coordinate automation (cliclick) is unreliable — prefer screenshots +
the app's built-in easter-egg triggers over multi-step coordinate taps. If a flow genuinely
can't be verified in the simulator, say so and ask Sami before shipping.

If the smoke test surfaces a problem, STOP and fix — that's the whole point of the gate.

## Step 1 — did iOS-bundled code change?

The native app bundles the Vite build (`dist/` → `cap sync ios`), so "iOS changed" = anything
that lands in the bundle or the native project:

```bash
# Files committed/working since the last push:
git diff --stat @{push} HEAD 2>/dev/null; git status --porcelain
```

iOS changed if any path matches `frontend/src/`, `frontend/public/`, `frontend/index.html`,
`frontend/capacitor.config.ts`, `frontend/package.json` (deps), or `frontend/ios/`.
It did NOT change if the session was backend-only, docs-only, or touched only `frontend/test/`
or `scripts/` / CI. State your verdict explicitly.

## Step 2 — (iOS changed only) bump the build number

The pipeline does NOT auto-increment; `altool` rejects a duplicate. Take the next number from
what's actually live on TestFlight, not the local `.env.ios`:

```bash
scripts/ios/list-builds.sh        # prints "NEXT build number -> set BUILD_NUMBER=N"
```

Set `BUILD_NUMBER=N` in `scripts/ios/.env.ios` (gitignored — never commit it), then stamp the
Xcode project so the committed pbxproj carries the bump:

```bash
scripts/ios/01-install-and-build.sh     # FOREGROUND (pod install needs network)
scripts/ios/02-configure-xcode-project.sh
```

## Step 3 — commit to main (run /finalize discipline)

Follow the [finalize](../finalize/SKILL.md) procedure: review docs/CLAUDE.md/memory, then make
logical, atomic commits. Direct commits to `main` are Sami's chosen workflow here — the two
gates above are what make that safe (they replace the branch-PR safety net).

- Name files explicitly (`git add <files>`) — NEVER `git add -A`/`.`.
- Verify `git status` shows `scripts/ios/.env.ios` untracked/ignored and no key material staged
  (this is a PUBLIC repo).
- If iOS changed, include the `frontend/ios/App/App.xcodeproj/project.pbxproj` build-number bump
  in the iOS commit.
- Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Step 4 — push

```bash
git push origin main            # FOREGROUND (network)
```

## Step 5 — (iOS changed only) upload to TestFlight — FOREGROUND

Network steps MUST run foreground; background Bash is sandboxed off the internet (cost a failed
~10-min run on this project before). Steps 01+02 already ran in Step 2, so continue the pipeline:

```bash
scripts/ios/03-register-bundle-id.sh
scripts/ios/05-archive.sh         # slowest step
scripts/ios/06-export-ipa.sh
scripts/ios/07-upload-testflight.sh
```

(`scripts/ios/all.sh` runs 00–07 in one shot and every step is idempotent, but the full chain
usually exceeds the 600s foreground cap. If a step times out, re-run from `05-archive.sh` —
DerivedData stays warm, so it resumes fast. `altool` sometimes fails the FIRST upload with a
spurious "Defaults.properties" error — just re-run `07`.)

## Step 6 — report

Tell Sami concisely: commits made (+ hashes), pushed yes/no, and either "TestFlight build N
uploaded — live in ~10 min" or "TestFlight skipped — no iOS-bundled changes this session."
