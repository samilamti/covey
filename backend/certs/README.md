# backend/certs — BankID RP certificates (gitignored)

The BankID provider (`src/auth/providers/bankid.js`) reads its mutual-TLS material
from here by default. Nothing in this folder is committed except this README and
`.gitignore`.

## Test environment (free, no agreement)

Run from the repo root:

```bash
scripts/bankid/setup-test-cert.sh
```

That produces:

| File | What | Used as |
|---|---|---|
| `test-client-cert.pem` | RP client certificate (FP Testcert 5) | `BANKID_CERT_PATH` |
| `test-client-key.pem` | RP private key (plaintext PKCS#8) | `BANKID_KEY_PATH` |
| `ca_test.crt` | BankID **test** root CA — TLS trust anchor | `BANKID_CA_PATH` |

The client material comes from BankID's public test certificate
**`FPTestcert5_20240610`** (passphrase `qwerty123`). Canonical source:
<https://developers.bankid.com/test-portal/certificate>. The setup script pulls it
from a GitHub mirror because the BankID portal is behind bot-protection that blocks
headless download — verify the bytes against the portal copy if you want certainty.

Verified working: `ca_test.crt` validates the live `appapi2.test.bankid.com` server
cert, and the client cert/key complete a real mTLS `/auth` → `/collect` → `/cancel`
round-trip against the test API.

## Production

Do **not** reuse the test material. Supply the real RP certificate (from your broker
or bank — see `../../../ops/tech/bankid-connection-options.md` in the private ops
repo) and point the env at it:

```
BANKID_API_URL=https://appapi2.bankid.com/rp/v6.0
BANKID_CERT_PATH=/secure/path/rp-cert.pem
BANKID_KEY_PATH=/secure/path/rp-key.pem
BANKID_CA_PATH=/secure/path/prod-ca.crt
BANKID_CERT_PASSPHRASE=...        # if the key is encrypted
```
