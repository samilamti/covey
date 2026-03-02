---
name: deploy-check
description: Run pre-deployment validation checklist (tests, build, locale parity). Use before deploying to production or pushing to main.
---

Run pre-deployment validation checklist. Run each check sequentially. Stop and report if any check fails.

### 1. Backend tests
```bash
cd backend && npm test
```
All tests must pass.

### 2. Frontend tests
```bash
cd frontend && npm test
```
All tests must pass (includes locale key parity check).

### 3. Frontend build
```bash
cd frontend && npm run build
```
Check output for:
- Chunk size warnings (Vite warns at 200KB, current known size is ~251KB)
- Any build errors
- Report the largest chunk size

### 4. Locale parity
Read all 11 locale files in `frontend/src/locales/` and verify key parity against `sv.json`. Report any mismatches.

### 5. Summary
```
Deploy Readiness Report
========================
Backend tests:  PASS/FAIL (count)
Frontend tests: PASS/FAIL (count)
Frontend build: PASS/FAIL (largest chunk: XXX KB)
Locale parity:  PASS/FAIL (11/11 files)

Result: GO / NO-GO
```

If any check fails, report NO-GO with details on what needs fixing.

## Notes
- There is no staging environment — this checklist is the safety net before production
- The ~251KB chunk warning is known technical debt (threshold is 200KB) — flag it but don't block on it
- If locale parity fails, suggest running `/add-locale-key` to fix missing keys
