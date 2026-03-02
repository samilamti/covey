---
name: locale-check
description: Validate i18n key parity across all 11 locale files. Use after editing locale files or before committing i18n changes.
---

Validate i18n key parity across all 11 locale files.

1. Read `frontend/src/locales/sv.json` — this is the canonical source of truth.
2. Read all other locale files: `nb.json`, `da.json`, `fi.json`, `ar.json`, `is.json`, `pl.json`, `fo.json`, `kl.json`, `se.json`, `en.json`.
3. For each locale file:
   - Verify it parses as valid JSON
   - Extract all keys (recursively for nested objects, using dot notation like `request.title`)
   - Compare against `sv.json` keys
   - Report missing keys (in sv but not in this locale)
   - Report extra keys (in this locale but not in sv)
4. Summarize results:
   - If all files are in parity: report success
   - If there are issues: list each locale with its missing/extra keys

## Locale files
Path: `frontend/src/locales/`
Languages: sv (canonical), nb, da, fi, ar, is, pl, fo, kl, se, en (11 total)

## Notes
- Swedish (`sv`) is the base language, NOT English
- All translations should be derived from Swedish source text
- The frontend test suite includes a parity test (`test/i18n.test.js`) that checks the same thing — this skill is a quick standalone check without running the full test suite
