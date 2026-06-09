# Android build & publish pipeline

Mirrors `scripts/ios/` for the Google Play side. Builds a signed **AAB** and
(once Play API access is configured) uploads it to a track and pushes the store
listing — entirely from the CLI.

```
00-prereqs.sh        Verify Java 17, Android SDK, gcloud, Python venv, Play API auth
01-firebase-config.sh  Register the Android app in Firebase + fetch google-services.json
02-keystore.sh       Generate the upload keystore (password → macOS Keychain)
03-build-aab.sh      vite build → cap sync → gradlew bundleRelease (signed)
04-play-listing.sh   Push listing text + graphics via the Play Developer API
05-upload-aab.sh     Upload AAB to $TRACK + release notes, commit (sends for review)
06-screenshots.sh    Capture phone screenshots from an emulator (best-effort)
all.sh               00→03 always; 04→05 when PLAY_SA_JSON is set
lib/                 common.sh, play-api.sh, play-token.py
listing/             store copy (per-locale) + graphics consumed by 04
```

## Setup

```bash
cp .env.android.example .env.android   # then edit if needed (defaults already match Covey)
./all.sh
```

`.env.android`, the keystore (`*.jks`), and `keystore.properties` are gitignored.
Signing passwords live in the macOS Keychain (`covey-android` / `covey-upload-keystore-password`),
never on disk. `google-services.json` is committed (it ships in every APK — it is
client config, not a secret), matching how the iOS `GoogleService-Info.plist` is tracked.

---

## One-time hand-offs (Sami — these are web-UI only)

The Play Developer API **cannot create the app** (same as Apple). Do these once:

### 1. Create the app
Play Console → **Create app**
- App name: **Covey**
- Default language: **Swedish (Sweden) – sv-SE**
- App or game: **App** · Free
- Accept the declarations.

### 2. Set up API access (unlocks 04/05)
Play Console → **Setup → API access**
- Link or create a Google Cloud project, then **Create a new service account**
  (opens Google Cloud → IAM → Service Accounts → create → no project roles needed).
- Back in Play Console, on that service account click **Grant access** and give it at
  least **Release manager** (Admin is fine), scoped to the Covey app.
- In Google Cloud, create a **JSON key** for the service account and download it.
- Save it OUTSIDE the repo, e.g. `~/.config/covey/play-service-account.json`, and point
  `PLAY_SA_JSON` in `.env.android` at it. (Newly granted access can take a few minutes.)

### 3. First upload / Play App Signing
On the first AAB, Play enrolls **Play App Signing** (Google holds the app signing key; our
keystore is the *upload* key — resettable later). If `05-upload-aab.sh` is rejected pending
enrollment, upload the AAB **once via the UI** (Testing → Closed testing → create release →
upload `app/build/outputs/bundle/release/app-release.aab` → accept Play App Signing), then all
later uploads go through `./05-upload-aab.sh`.

### 4. Finish the closed-test release
Play Console (or via the scripts where supported):
- **Closed testing** track → add **≥12 testers** (email list or a Google Group) and copy the
  opt-in link. *Personal-account rule:* 12+ testers opted in for **14 continuous days** before
  production access opens — start this clock now.
- Complete **Store listing** (04 pushes text + graphics), **Content rating** (IARC), **Data
  safety**, **Target audience**, **App content** declarations. See `PLAY_LISTING.md` for the
  prepared answers.
- **Send for review.**

---

## Rebuild / re-release later
Bump `versionCode` (and `versionName`) in `frontend/android/app/build.gradle`, then:
```bash
./03-build-aab.sh && ./05-upload-aab.sh
```
