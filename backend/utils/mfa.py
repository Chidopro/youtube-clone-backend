"""ScreenMerch multi-factor authentication helpers.

MFA configuration is encrypted before it is stored in the existing private
creator settings bucket. No authenticator secret or recovery code is stored in
plain text.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import struct
import time
from urllib.parse import quote


MFA_BUCKET = "creator-logos"
MFA_PATH = "mfa-config.png"


def _key():
    material = (
        os.environ.get("MFA_ENCRYPTION_KEY")
        or os.environ.get("FLASK_SECRET_KEY")
        or ""
    ).encode("utf-8")
    if not material:
        raise RuntimeError("MFA encryption key is not configured")
    return hashlib.sha256(b"screenmerch-mfa-v1:" + material).digest()


def _stream(key, nonce, length):
    output = bytearray()
    counter = 0
    while len(output) < length:
        output.extend(hmac.new(key, nonce + struct.pack(">I", counter), hashlib.sha256).digest())
        counter += 1
    return bytes(output[:length])


def encrypt_config(config):
    raw = json.dumps(config, separators=(",", ":"), sort_keys=True).encode("utf-8")
    key = _key()
    nonce = secrets.token_bytes(16)
    cipher = bytes(a ^ b for a, b in zip(raw, _stream(key, nonce, len(raw))))
    tag = hmac.new(key, b"tag:" + nonce + cipher, hashlib.sha256).digest()
    return b"SMFA1" + nonce + tag + cipher


def decrypt_config(blob):
    data = bytes(blob or b"")
    if not data.startswith(b"SMFA1") or len(data) < 53:
        raise ValueError("Invalid MFA configuration")
    nonce, tag, cipher = data[5:21], data[21:53], data[53:]
    key = _key()
    expected = hmac.new(key, b"tag:" + nonce + cipher, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expected):
        raise ValueError("Invalid MFA configuration signature")
    raw = bytes(a ^ b for a, b in zip(cipher, _stream(key, nonce, len(cipher))))
    return json.loads(raw.decode("utf-8"))


def default_config():
    return {
        "email_enabled": False,
        "totp_enabled": False,
        "totp_secret": None,
        "recovery_hashes": [],
    }


def read_mfa_config(client, user_id):
    if not client or not user_id:
        return default_config()
    try:
        blob = client.storage.from_(MFA_BUCKET).download(f"{user_id}/{MFA_PATH}")
        loaded = decrypt_config(blob)
        return {**default_config(), **(loaded if isinstance(loaded, dict) else {})}
    except Exception:
        return default_config()


def write_mfa_config(client, user_id, config):
    if not client or not user_id:
        return False
    path = f"{user_id}/{MFA_PATH}"
    bucket = client.storage.from_(MFA_BUCKET)
    payload = encrypt_config({**default_config(), **config})
    options = {"content-type": "image/png", "upsert": "true"}
    try:
        bucket.upload(path=path, file=payload, file_options=options)
        return True
    except Exception:
        try:
            bucket.remove([path])
            bucket.upload(path=path, file=payload, file_options=options)
            return True
        except Exception:
            return False


def generate_totp_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret, at_time=None):
    padded = str(secret).upper() + "=" * ((8 - len(str(secret)) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    counter = int((at_time if at_time is not None else time.time()) // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{number:06d}"


def verify_totp(secret, code, at_time=None, window=1):
    clean = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(clean) != 6 or not secret:
        return False
    now = at_time if at_time is not None else time.time()
    return any(
        hmac.compare_digest(totp_code(secret, now + offset * 30), clean)
        for offset in range(-window, window + 1)
    )


def otpauth_uri(secret, email):
    issuer = "ScreenMerch"
    label = quote(f"{issuer}:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={quote(secret)}"
        f"&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"
    )


def generate_recovery_codes(count=8):
    return [f"{secrets.token_hex(3).upper()}-{secrets.token_hex(3).upper()}" for _ in range(count)]


def recovery_hash(code):
    normalized = str(code or "").strip().upper().replace(" ", "")
    return hmac.new(_key(), f"recovery:{normalized}".encode("utf-8"), hashlib.sha256).hexdigest()


def consume_recovery_code(config, code):
    candidate = recovery_hash(code)
    hashes = list(config.get("recovery_hashes") or [])
    for stored in hashes:
        if hmac.compare_digest(str(stored), candidate):
            config["recovery_hashes"] = [value for value in hashes if value != stored]
            return True
    return False
