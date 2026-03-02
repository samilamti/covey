---
name: add-locale-key
description: Add a new translation key to all 11 locale files with Swedish text and optional auto-translation. Use when adding new UI strings.
argument-hint: "<key.path> <Swedish text>"
---

Add a new translation key to all 11 locale files. Parse `$ARGUMENTS` for the key path (dot-separated, e.g. `session.greeting`) and the Swedish text value.

### Step 1 — Add to sv.json
Read `frontend/src/locales/sv.json`, add the new key with the Swedish value, write it back. Maintain existing JSON formatting and alphabetical key order within each nesting level.

### Step 2 — Add placeholder to other 10 locales
For each of: `nb.json`, `da.json`, `fi.json`, `ar.json`, `is.json`, `pl.json`, `fo.json`, `kl.json`, `se.json`, `en.json`:
- Read the file
- Add the same key with value `[TODO] <Swedish text>` as a translation placeholder
- Write it back, maintaining formatting

### Step 3 — Translate
Ask the user if they want Claude to translate the placeholders now. If yes:
- Translate from Swedish to each target language
- Tone: warm, colloquial (not formal/bureaucratic)
- These are UI strings for a safety app — keep translations natural and approachable
- Languages: Norwegian Bokmål (nb), Danish (da), Finnish (fi), Arabic (ar), Icelandic (is), Polish (pl), Faroese (fo), Kalaallisut/Greenlandic (kl), Northern Sami (se), English (en)

### Step 4 — Verify
Run the locale parity check: read all 11 files and confirm they all have the new key.

## Notes
- `sv.json` is canonical — always add there first
- Arabic (ar) is RTL — no special handling needed in JSON, i18next handles it
- Kalaallisut (kl) and Northern Sami (se) are less common — best-effort translations are acceptable
