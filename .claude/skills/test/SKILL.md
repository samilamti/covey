---
name: test
description: Run backend and/or frontend tests. Use after code changes, before commits, or when debugging test failures.
argument-hint: "[backend|frontend|all]"
---

Run project tests. Parse `$ARGUMENTS` to determine scope:
- `backend` or `be` → backend only
- `frontend` or `fe` → frontend only
- blank or `all` → both (run in parallel)

### Backend tests
```
cd backend && npm test
```
Uses `node:test` — tests across auth, eligibility, features, nin, ratings.

### Frontend tests
```
cd frontend && npm test
```
Uses `vitest` — tests across i18n parity, components, feature flags.

## Reporting

After tests complete, report:
- Total pass/fail counts for each suite
- Any failing test names and error summaries
- If all pass, confirm with a brief summary
