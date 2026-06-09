#!/usr/bin/env python3
"""Mint a Google Play Developer API (androidpublisher) OAuth2 access token
from a service-account JSON, using the JWT-bearer flow.

Mirrors scripts/ios/lib/asc-jwt.py but for Google's service accounts:
  header  {alg: RS256, typ: JWT}
  claims  {iss, scope, aud, iat, exp}
  signed  with the SA private_key (RS256)
  exchanged at https://oauth2.googleapis.com/token for an access_token.

Usage:
  python3 play-token.py /path/to/service-account.json
Prints the access token to stdout. Requires `cryptography` (installed in the
scripts/android/.venv venv by 00-prereqs.sh).
"""
import base64
import json
import sys
import time
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

SCOPE = "https://www.googleapis.com/auth/androidpublisher"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def b64url(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: play-token.py <service-account.json>", file=sys.stderr)
        return 2
    sa = json.load(open(sys.argv[1]))
    client_email = sa["client_email"]
    private_key = sa["private_key"]

    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claims = {
        "iss": client_email,
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = (
        b64url(json.dumps(header, separators=(",", ":")).encode())
        + b"."
        + b64url(json.dumps(claims, separators=(",", ":")).encode())
    )

    key = serialization.load_pem_private_key(private_key.encode(), password=None)
    signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    assertion = signing_input + b"." + b64url(signature)

    body = urllib.parse.urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion.decode(),
        }
    ).encode()

    req = urllib.request.Request(TOKEN_URL, data=body)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            token = json.load(resp)["access_token"]
    except urllib.error.HTTPError as e:
        print(f"token exchange failed: HTTP {e.code}\n{e.read().decode()}", file=sys.stderr)
        return 1
    print(token)
    return 0


if __name__ == "__main__":
    sys.exit(main())
