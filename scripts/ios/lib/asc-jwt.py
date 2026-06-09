#!/usr/bin/env python3
"""
Generate an ES256 JWT for the App Store Connect API.

Reads from environment:
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH

Prints the JWT to stdout (no trailing newline).

Spec: https://developer.apple.com/documentation/appstoreconnectapi/generating_tokens_for_api_requests
"""
import base64
import json
import os
import sys
import time

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
except ImportError:
    sys.stderr.write(
        "asc-jwt: missing 'cryptography' library.\n"
        "Install: pip3 install --user cryptography\n"
    )
    sys.exit(1)


def b64url(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def main() -> int:
    key_id = os.environ.get("ASC_KEY_ID")
    issuer = os.environ.get("ASC_ISSUER_ID")
    key_path = os.environ.get("ASC_KEY_PATH")

    for name, val in [("ASC_KEY_ID", key_id), ("ASC_ISSUER_ID", issuer), ("ASC_KEY_PATH", key_path)]:
        if not val:
            sys.stderr.write(f"asc-jwt: {name} not set\n")
            return 1

    if not os.path.isfile(key_path):
        sys.stderr.write(f"asc-jwt: key not found at {key_path}\n")
        return 1

    header = b64url(
        json.dumps({"alg": "ES256", "kid": key_id, "typ": "JWT"}, separators=(",", ":")).encode()
    )
    claims = b64url(
        json.dumps(
            {"iss": issuer, "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = header + b"." + claims

    with open(key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    der_sig = private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_sig)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")

    jwt = signing_input + b"." + b64url(raw_sig)
    sys.stdout.write(jwt.decode())
    return 0


if __name__ == "__main__":
    sys.exit(main())
