import importlib.util
from pathlib import Path
import unittest
from unittest import mock
import tempfile

spec = importlib.util.spec_from_file_location('signing', Path(__file__).resolve().parents[1] / 'scripts/setup-android-signing.py')
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)


class BackupTests(unittest.TestCase):
    def test_permissions_are_required_before_generating_key(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'not-created'
            with mock.patch.object(signing.sys, 'platform', 'darwin'), \
                 mock.patch.object(signing, 'DIRECTORY', directory), \
                 mock.patch.object(signing, 'run', side_effect=RuntimeError('permission denied')):
                with self.assertRaisesRegex(RuntimeError, 'permission denied'):
                    signing.main()
            self.assertFalse(directory.exists())

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
