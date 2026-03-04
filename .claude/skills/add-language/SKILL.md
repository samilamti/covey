---
name: add-language
description: Add a new supported language to the application. Use when expanding locale support beyond the current 12 languages.
argument-hint: "<language-code> <native-name>"
---

Add a new language. Parse `$ARGUMENTS` for the ISO 639-1 code (e.g. `de`) and the native name (e.g. `Deutsch`).

This is a 5-step process — missing any step breaks the language.

### Step 1 — Create the locale JSON file

Create `frontend/src/locales/<code>.json` by copying the structure from `sv.json` (canonical).

All values should be translations of the Swedish text. Tone: warm, colloquial, not bureaucratic. These are UI strings for a safety app — keep them natural and approachable.

### Step 2 — Import in i18n.js

Add to `frontend/src/i18n.js`:

```js
import <code> from './locales/<code>.json'   // add with the other imports
```

### Step 3 — Add to resources object

In the same file, add to the `resources` object inside `i18n.init()`:

```js
resources: {
  // ... existing languages ...
  <code>: { translation: <code> },   // add here
},
```

### Step 4 — Add to LanguageSelector

In `frontend/src/components/LanguageSelector.jsx`:

1. Import or create a flag component. Options:
   - Use an existing emoji flag component from `./flags`
   - Create a new SVG flag component in `frontend/src/components/flags/` following the pattern of existing flags
2. Add to the `languages` array:
```js
{ code: '<code>', label: '<NativeName>', flag: <FlagComponent> },
```

### Step 5 — Add RTL support (if applicable)

If the language is RTL (like Arabic), add to the languageChanged handler in `i18n.js`:
```js
document.dir = ['ar', '<code>'].includes(lng) ? 'rtl' : 'ltr'
```

### Step 6 — Add notification body strings

Push notification bodies are hardcoded per language in `backend/src/services/notifications.js` (push runs outside browser, no i18next). Add a new entry for the language code.

### Verification
- Run `/locale-check` to verify key parity
- Run `/test frontend` — the i18n parity test in `test/i18n.test.js` checks all locale files
- Visit the app and select the new language from the dropdown

## Notes
- Swedish (`sv`) is canonical — translate FROM Swedish, not from English
- The detection order is `['querystring', 'localStorage', 'cookie']` — no browser auto-detection. Fresh visitors always get Swedish
- Currently 12 languages: sv, nb, da, fi, ar, is, pl, fo, kl, se, uk, en
- Flag SVGs are in `frontend/src/components/flags/` — each is a simple functional component accepting `{ size }` prop
