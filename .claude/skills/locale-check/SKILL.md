---
name: locale-check
description: Validate i18n key parity across all 12 locale files. Use after editing locale files or before committing i18n changes.
---

Validate i18n key parity across all 12 locale files using a dedicated script.

Run this command via Bash:

```bash
node .claude/scripts/locale-check.cjs
```

Report the output to the user. If there are missing/extra keys, suggest fixes.

## Locale files
Path: `frontend/src/locales/`
Languages: sv (canonical), nb, da, fi, ar, is, pl, fo, kl, se, uk, en (12 total)

## Notes
- Swedish (`sv`) is the base language, NOT English
- All translations should be derived from Swedish source text
- The script at `.claude/scripts/locale-check.cjs` recursively extracts all keys (dot notation) from each locale file and compares against `sv.json`
- The frontend test suite includes a parity test (`test/i18n.test.js`) that checks the same thing — this skill is a quick standalone check without running the full test suite
