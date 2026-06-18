#!/usr/bin/env bash
#
# setup-test-cert.sh — fetch + prepare the FREE BankID test certificate.
#
# Produces Node-friendly PEM material in backend/certs/ so the BankID provider
# (src/auth/providers/bankid.js) can talk to the BankID test environment with
# zero cost and no agreement. Idempotent; safe to re-run.
#
# Canonical cert source is https://developers.bankid.com/test-portal/certificate
# (FPTestcert5_20240610, passphrase qwerty123). That portal is behind
# bot-protection that blocks headless download, so we pull the public test cert
# from a GitHub mirror instead. Override MIRROR=... if you vendor your own copy.
#
# Usage:  scripts/bankid/setup-test-cert.sh
set -euo pipefail

# macOS / OpenSSL locale guard (see ~/.claude notes)
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CERT_DIR="$REPO_ROOT/backend/certs"
PASSPHRASE="${BANKID_TEST_PASSPHRASE:-qwerty123}"
MIRROR="${MIRROR:-https://raw.githubusercontent.com/nicolaa5/bankid/main/certs}"

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

echo "→ Downloading public BankID test cert (FPTestcert5_20240610) + test CA…"
curl -fsSL -o FPTestcert5_20240610.p12 "$MIRROR/FPTestcert5_20240610.p12"
curl -fsSL -o ca_test.crt              "$MIRROR/ca_test.crt"

echo "→ Extracting Node-friendly PEM (client cert + plaintext key)…"
# -legacy: the BankID p12 uses legacy PKCS#12 algorithms that OpenSSL 3 gates.
openssl pkcs12 -in FPTestcert5_20240610.p12 -clcerts -nokeys -legacy \
  -passin "pass:$PASSPHRASE" -out test-client-cert.pem
openssl pkcs12 -in FPTestcert5_20240610.p12 -nocerts -nodes  -legacy \
  -passin "pass:$PASSPHRASE" -out test-client-key.pem

echo "→ Verifying the CA validates the live test server…"
if echo | openssl s_client -connect appapi2.test.bankid.com:443 \
     -servername appapi2.test.bankid.com -CAfile ca_test.crt 2>/dev/null \
     | grep -q "Verify return code: 0"; then
  echo "  ✓ ca_test.crt trusts appapi2.test.bankid.com"
else
  echo "  ! could not verify against the live server (offline?) — continuing"
fi

echo ""
echo "Done. Files in backend/certs/:"
ls -1 test-client-cert.pem test-client-key.pem ca_test.crt
cat <<'NEXT'

Next:
  1. backend env:  AUTH_PROVIDER=bankid  FEATURE_BANKID_AUTH=true
  2. start the backend, then open  http://localhost:3000/api/auth/bankid/dev
  3. scan the QR with a test BankID (developers.bankid.com → "BankID for test")
See docs/bankid-test.md for the full walkthrough.
NEXT
