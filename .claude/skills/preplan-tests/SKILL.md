---
name: preplan-tests
description: Write failing tests that cover a plan's expected behavior BEFORE implementing the plan. Use every time you start working on an accepted plan (TDD red phase).
---

Run this procedure after a plan is accepted but BEFORE writing any implementation code. The goal is test-driven development: write tests that describe the expected behavior first, verify they fail, then hand off to implementation.

## 1. Analyze the plan

Read the accepted plan and extract every observable behavior change:
- New API endpoints or changed responses
- New or changed component rendering / user interactions
- New or changed pure functions (business logic, utilities)
- New or changed Socket.io events
- New or changed database queries (test via the pure functions that wrap them)

Categorize each behavior as **backend** or **frontend**.

## 2. Decide what to test

Not everything needs a new test. Apply these filters:

**DO write tests for**:
- New pure/exported functions (business logic, validators, formatters)
- New API response shapes (mock the DB, test the route handler logic if extractable)
- New component states and user interactions
- New hook behavior
- Changed behavior of existing tested functions
- Edge cases called out in the plan

**Do NOT write tests for**:
- Database queries directly (no DB in tests — test the pure logic they feed)
- Socket.io handlers directly (no running server — test extracted pure logic)
- Simple wiring (imports, route registration, middleware ordering)
- UI styling or layout-only changes
- Changes already covered by existing tests

## 3. Write the tests

Follow the project's test conventions (see `/add-test` skill for full patterns):

### Backend (`backend/test/<name>.test.js`)
- `node:test` with `assert` from `node:assert/strict`
- Pure unit tests only — no DB, no HTTP server, no Socket.io
- Import the function-to-be-created directly (the import will fail until implementation exists, that's fine — we verify the test *structure* is correct)

### Frontend (`frontend/test/<Name>.test.jsx`)
- `vitest` + `@testing-library/preact`
- Standard mocks: i18next, lucide-preact, services, hooks
- `consoleErrorSpy` pattern in beforeEach/afterEach
- Mutable `hookState` pattern for per-test hook control
- `await import()` after `vi.mock()` for mocked modules

### Conventions
- One test file per logical concern (not per plan bullet point)
- If an existing test file covers the module being changed, ADD tests to it rather than creating a new file
- Test names should describe the expected behavior in plain language
- Group related tests in `describe` blocks matching the function/component name

## 4. Verify tests fail (red phase)

Run the tests to confirm they fail for the right reasons:

```bash
cd backend && npm test    # if backend tests were written
cd frontend && npm test   # if frontend tests were written
```

Expected failure modes:
- **Import errors** — the module/function doesn't exist yet (good)
- **Assertion failures** — the function exists but doesn't have the new behavior yet (good)
- **Unexpected passes** — the behavior already exists (remove the redundant test or adjust it to test something new)

If a test fails for the wrong reason (syntax error in the test, wrong mock setup), fix the test before proceeding.

## 5. Report and hand off

Summarize what was created:
```
Pre-implementation tests
========================
Backend:  N new tests in M files
Frontend: N new tests in M files

Failing (expected):
- <test name>: <why it fails>
- ...

Ready for implementation.
```

Then proceed with the plan implementation. The tests become the acceptance criteria — implementation is done when all pre-written tests pass (plus any existing tests still pass).

## Notes
- This is the TDD "red" phase — tests SHOULD fail. That's the point.
- Keep tests focused on behavior, not implementation details. Don't assert on internal state or private function calls.
- If the plan changes during implementation, update the pre-written tests to match.
- After implementation, run `/test all` to verify both new and existing tests pass (the "green" phase).
- If a plan only touches docs, config, or locale files with no behavior changes, skip this skill — there's nothing to test.
