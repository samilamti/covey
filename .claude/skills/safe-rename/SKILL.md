---
name: safe-rename
description: Project-wide rename with verification. Greps for all occurrences, edits every file, re-greps to confirm zero remaining, and runs tests. Use when renaming functions, variables, CSS classes, or any identifier across the codebase.
argument-hint: "<old-name> <new-name>"
---

Safely rename an identifier across the entire project. Parse `$ARGUMENTS` for the old name and new name.

### Step 1 — Find all occurrences

Search for every occurrence of the old name using Grep:

```
pattern: OLD_NAME
glob: "*.{js,jsx,json,yaml,yml,md,html,css}"
output_mode: content
```

Also check these commonly missed locations:
- `CLAUDE.md` and any `.md` docs
- `.github/workflows/*.yml` CI configs
- `docker-compose*.yml` files
- `frontend/public/sw.js`

### Step 2 — List the change plan

List every file that contains the old name and needs changes. Group by category:
- **Code** (`.js`, `.jsx`)
- **Config** (`.json`, `.yaml`, `.yml`)
- **Docs** (`.md`, `.html`)
- **Styles** (`.css`)

Ask the user to confirm before proceeding.

### Step 3 — Make all edits

Edit each file, replacing the old name with the new name. Use the Edit tool with `replace_all: true` per file when the old name appears multiple times.

Order of edits:
1. Source definitions (where the identifier is declared/exported)
2. Consumers (where the identifier is imported/used)
3. Tests
4. Config and docs

### Step 4 — Verify zero remaining

Re-run the grep from Step 1 to confirm zero occurrences of the old name remain:

```
pattern: OLD_NAME
glob: "*.{js,jsx,json,yaml,yml,md,html,css}"
output_mode: count
```

If any remain, fix them before proceeding.

### Step 5 — Run full test suite

Run both backend and frontend tests:

```bash
cd backend && npm test
```
```bash
cd frontend && npm test
```

Report results. Do not commit if tests fail.

## Notes
- Be careful with partial matches — `userName` grep will also match `userNameList`. Use word boundaries or review matches manually.
- Check for string literals too (e.g., error messages, log statements, locale keys that reference the old name).
- If renaming a database column, a migration is also needed — this skill covers code only.
