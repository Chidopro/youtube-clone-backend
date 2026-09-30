import os
import time
import unittest

os.environ.setdefault("FLASK_SECRET_KEY", "unit-test-secret")

from utils.mfa import (  # noqa: E402
    consume_recovery_code,
    decrypt_config,
    encrypt_config,
    generate_recovery_codes,
    generate_totp_secret,
    recovery_hash,
    totp_code,
    verify_totp,
)


class MfaTest(unittest.TestCase):
    def test_config_encryption_round_trip(self):
        config = {"email_enabled": True, "totp_secret": "SECRET"}
        encrypted = encrypt_config(config)
        self.assertNotIn(b"SECRET", encrypted)
        self.assertEqual(decrypt_config(encrypted), config)

    def test_totp_accepts_current_window_and_rejects_wrong_code(self):
        secret = generate_totp_secret()
        now = time.time()
        self.assertTrue(verify_totp(secret, totp_code(secret, now), now))
        self.assertFalse(verify_totp(secret, "000000", now))

    def test_recovery_code_is_one_time(self):
        code = generate_recovery_codes(1)[0]
        config = {"recovery_hashes": [recovery_hash(code)]}
        self.assertTrue(consume_recovery_code(config, code))
        self.assertFalse(consume_recovery_code(config, code))


if __name__ == "__main__":
    unittest.main()
