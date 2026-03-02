---
name: login
description: Automate the stub BankID login flow against the local stack and output a JWT token. Use when you need an auth token for API testing.
argument-hint: "[nin]"
---

Automate the stub BankID login flow and output a JWT token.

### Step 1 — Start login
```bash
curl -sk -X POST https://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"nin": "<NIN>"}'
```
**Note**: The API field is `nin`.

If no NIN provided in `$ARGUMENTS`, use `199001011234` (female, born 1990).

Save the `orderRef` from the response.

### Step 2 — Poll collect (wait 3.5 seconds first)
The stub provider simulates BankID timing:
- 0–1.5s: `pending` (outstanding order)
- 1.5–3s: `userSign` (user signing)
- >3s: `complete` (done)

Wait 3.5 seconds, then:
```bash
curl -sk -X POST https://localhost/api/auth/collect \
  -H 'Content-Type: application/json' \
  -d '{"orderRef": "<ORDER_REF>"}'
```

If status is not `complete`, wait 1 more second and retry (max 3 attempts).

### Step 3 — Output the token
Print the JWT token from the `complete` response. Also decode and show:
- `userId` (DB UUID)
- `name`
- Demographics (birth year, sex derived from NIN)

## NIN reference
- Format: 12 digits (YYYYMMDDNNNN)
- Birth year: first 4 digits
- Sex: second-to-last digit — odd = male (M), even = female (F)
- Error simulation: `000*` prefix = userCancel, `111*` prefix = expiredTransaction
- Default test NIN: `199001011234` (female, born 1990)
