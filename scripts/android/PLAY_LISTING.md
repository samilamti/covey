# Play Console — prepared answers (UI-paste)

Store **text + graphics** are pushed by `04-play-listing.sh`. The items below have
no clean API and must be entered in the Play Console UI. Everything here is
pre-filled from Covey's actual data model and behavior — review and submit.

---

## App access (CRITICAL — reviewers can't use BankID)

Covey logs in with Swedish **BankID**, which Google's reviewers cannot complete.
Provide a **demo login** so review doesn't fail. In **App content → App access**,
choose "All or some functionality is restricted" and add one instruction:

> **All functionality** — Demo login (no BankID needed)
> On the start screen, type **999999999999** into the personnummer field and tap
> the login button. This enters a built-in demo persona with full app access
> (create requests, active session with live map, in-app chat). No real BankID,
> SMS, or personal data required.

---

## Store settings

| Field | Value |
|---|---|
| App category | **Lifestyle** (personal-safety utility; deliberately *not* "Social" — Covey is not a social network) |
| Tags | safety, community, local |
| Email | *(set a public support address, e.g. support@covey.se or your address)* |
| Website | https://covey.se |
| Privacy policy | https://docs.covey.se/sv/integritet/ |

---

## Target audience & content

- **Target age group:** 18+ (adults). Covey requires BankID and coordinates
  real-world meetups; it is not designed for or directed at children.
- **Appeals to children:** No.
- **Ads:** Contains no ads.

---

## Content rating (IARC questionnaire)

Category: **Utility, Productivity, Communication, or Other → Social/Communication**.

| Question | Answer |
|---|---|
| Violence | No |
| Sexuality / nudity | No |
| Profanity / crude humor | No |
| Controlled substances (drugs/alcohol/tobacco) | No |
| Gambling (simulated or real) | No |
| Users can **interact / communicate** | **Yes** (in-session text chat between two verified users) |
| Users can **share their location** | **Yes** (precise location shared with the helping user during an active session only) |
| User-generated content shared publicly | No (1:1 only, no public feed) |
| Personal/sensitive info shared with other users | Location + chosen display name, with the matched user only |

Expected outcome: **PEGI 3 / ESRB Everyone**, with "Users Interact" and "Shares
Location" descriptors.

---

## Data safety form

**Does your app collect or share user data?** Yes (collect). **Shared with third
parties?** No. **Encrypted in transit?** Yes. **Can users request deletion?** Yes
(in-app GDPR delete + 30-day hard delete; see privacy policy).

| Data type | Collected | Purpose | Shared | Notes |
|---|---|---|---|---|
| **Location** — approximate & precise | Yes | App functionality | No | Relayed only during an active session; `location_updates` purged automatically when the session ends. Never used for ads/tracking. |
| **Personal info** — User IDs | Yes | App functionality, Account management | No | Identity is the **SHA-256 hash of the personnummer** — the raw NIN is never stored. |
| **Personal info** — Other (sex, birth year) | Yes | App functionality | No | Derived from NIN; used only to match eligible companions (same sex, age ±5). |
| **Messages** — other in-app messages | Yes | App functionality | No | Session chat (`session_messages`); included in GDPR export. |
| **App activity** — other user-generated content / actions | Yes | App functionality | No | Assistance requests, points/badges. |
| **Device or other IDs** | Yes | App functionality | No | FCM push token (`native_push_tokens`) for delivering notifications. |

**Not collected:** financial info, health/fitness, contacts, photos/videos, audio,
files, calendar, browsing history, search history. **No data used for advertising
or third-party analytics.**

Security practices to check:
- ☑ Data is encrypted in transit (HTTPS / WSS).
- ☑ Users can request that data be deleted.
- ☐ Committed to Play Families Policy (N/A — 18+).

---

## Other "App content" declarations

- Government app: No (independent citizen initiative).
- Financial features: No.
- Health: No.
- News app: No.
- Data safety → "uses location in background": **No** (foreground only, during a session).
