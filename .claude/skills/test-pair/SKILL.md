---
name: test-pair
description: Set up two test users with compatible demographics for testing the request lifecycle. Use when testing assistance request flows end-to-end.
argument-hint: "[same_demographics|verified_guardians|any_member]"
---

Set up two test users with compatible demographics. Parse `$ARGUMENTS` for the eligibility tier: `same_demographics` (default), `verified_guardians`, or `any_member`.

### NIN pairs by tier

**`same_demographics`** — same sex AND birth year within ±5:
- User A: `199001011234` (female, born 1990)
- User B: `199301012384` (female, born 1993)
- Both female, 3 years apart — passes same_demographics check

**`verified_guardians`** — demographics match OR safety score >= 5:
- User A: `199001011234` (female, born 1990)
- User B: `197001011234` (female, born 1970)
- 20 years apart — FAILS demographics, needs safety score >= 5
- Remind user to set `STUB_SAFETY_SCORES=199001011234:6` in docker-compose.local.yml for User A (or User B) to pass via safety score path

**`any_member`** — no demographic filtering:
- User A: `199001011234` (female, born 1990)
- User B: `198501011235` (male, born 1985)
- Different sex — would fail same_demographics, but any_member has no restrictions

### Login flow (for each user)
1. `POST /api/auth/login` with `{"nin": "<NIN>"}`
2. Wait 3.5 seconds
3. `POST /api/auth/collect` with `{"orderRef": "<ORDER_REF>"}`
4. Save the token

### Output
Print both tokens and a summary:
```
User A: <NIN> (female, 1990)
Token: <JWT>

User B: <NIN> (female, 1993)
Token: <JWT>

Tier: same_demographics — these users ARE eligible to help each other
```

## Gotchas
- Age gap >5 years breaks `same_demographics` — the most common testing mistake
- Second-to-last digit of NIN determines sex: odd=M, even=F
- `STUB_SAFETY_SCORES` must be in docker-compose.local.yml AND the stack must be restarted for score overrides to take effect
- Stub scores are in-memory — users must re-login after stack restart for scores to re-populate
