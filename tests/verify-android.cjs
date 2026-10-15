const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('verifica identidad, certificado y Firebase antes de permitir distribución', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cerritos-apk-verification-'));
  try {
    const tools = path.join(temp, 'build-tools/36.0.0'); fs.mkdirSync(tools, { recursive: true });
    const script = (file, contents) => fs.writeFileSync(file, '#!/bin/bash\nset -eu\n' + contents, { mode: 0o700 });
    script(path.join(tools, 'apksigner'), 'printf "Signer #1 certificate SHA-256 digest: %s\\n" "$FIXTURE_CERT"\n');
    script(path.join(tools, 'aapt'), 'printf "package: name=\x27com.cerritoshome.app\x27 versionCode=\x278\x27 versionName=\x27%s\x27\\n" "$FIXTURE_VERSION"\n');
    script(path.join(temp, 'unzip'), 'printf \'{"projectId":"%s","authDomain":"app-cerritoshome.firebaseapp.com","apiOrigin":"https://mac-mini.tail653cc7.ts.net"}\' "$FIXTURE_PROJECT"\n');
    const apk = path.join(temp, 'fixture.apk'); fs.writeFileSync(apk, 'fixture: no real signing material');
    const env = { ...process.env, ANDROID_HOME: temp, PATH: temp + path.delimiter + process.env.PATH,
      CERRITOS_ANDROID_CERT_SHA256: '1'.repeat(64), FIXTURE_CERT: '1'.repeat(64), FIXTURE_VERSION: '0.5.0', FIXTURE_PROJECT: 'app-cerritoshome' };
    const verify = (changes = {}) => spawnSync(process.execPath, ['scripts/verify-android.mjs', apk], { cwd: path.resolve(__dirname, '..'), env: { ...env, ...changes }, encoding: 'utf8' });
    const good = verify(); assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(fs.readFileSync(apk + '.verification.json')).versionCode, 8);
    assert.notEqual(verify({ FIXTURE_CERT: '2'.repeat(64) }).status, 0);
    assert.notEqual(verify({ FIXTURE_VERSION: '0.4.3' }).status, 0);
    assert.notEqual(verify({ FIXTURE_PROJECT: 'different-project' }).status, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
