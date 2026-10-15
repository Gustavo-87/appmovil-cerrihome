import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('signing', Path(__file__).resolve().parents[1] / 'scripts/setup-android-signing.py')
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)


class BackupTests(unittest.TestCase):
    def test_roundtrip_and_wrong_password(self):
        payload = b'{"fixture":"not a real signing key"}'
        encrypted = signing.crypt(payload, 'fixture-password')
        self.assertNotIn(payload, encrypted)
        self.assertEqual(signing.crypt(encrypted, 'fixture-password', decrypt=True), payload)
        with self.assertRaises(RuntimeError):
            signing.crypt(encrypted, 'wrong-password', decrypt=True)
        altered = bytearray(encrypted)
        altered[-40] ^= 1
        with self.assertRaises(RuntimeError):
            signing.crypt(bytes(altered), 'fixture-password', decrypt=True)


if __name__ == '__main__':
    unittest.main()
