---
name: locale-update
description: Safely update or add keys in locale/translation JSON files. Reads all files fully before editing to prevent partial edits. Use when modifying existing i18n strings across locale files.
argument-hint: "<key.path> <new Swedish text>"
---

Safely update or modify a translation key across all 12 locale files. Parse `$ARGUMENTS` for the key path (dot-separated) and the new Swedish text value.

### Step 1 — Read ALL locale files

Read every file in `frontend/src/locales/` completely before making any edits:
`sv.json`, `nb.json`, `da.json`, `fi.json`, `ar.json`, `is.json`, `pl.json`, `fo.json`, `kl.json`, `se.json`, `uk.json`, `en.json`

**Never skip this step.** Partial reads lead to corrupted locale files.

### Step 2 — Confirm the change

List all 12 locale files found and state:
- The key to add or modify
- Whether the key already exists (update) or is new (add)
- The new Swedish value

### Step 3 — Edit each file

Edit each file one at a time:
- Preserve existing JSON structure and key sort order
- For new keys, insert alphabetically within the nesting level
- For updates, replace only the target value
- `sv.json` gets the provided Swedish text
- Other files: if adding a new key, use `[TODO] <Swedish text>` as placeholder (or translate if asked)
- If updating an existing key, ask whether to propagate the change to other languages or leave them

### Step 4 — Verify all files updated

Run via Bash:
```bash
cd frontend/src/locales && grep -lc '<KEY_PATH_LEAF>' *.json | wc -l
```
Replace `<KEY_PATH_LEAF>` with the innermost key name being added/modified.

### Step 5 — Report

Report:
- Number of files updated vs total locale files (expect 12/12)
- Any files that failed or were skipped

## Notes
- `sv.json` is canonical — always edit there first
- Arabic (ar) is RTL — no special JSON handling needed
- This skill is for updating existing or adding new keys. For key parity validation, use `/locale-check`
- For adding a brand-new key with translations, `/add-locale-key` may be more appropriate
