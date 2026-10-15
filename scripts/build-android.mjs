import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
const isWindows = process.platform === 'win32';
const executable = name => name + (isWindows ? '.exe' : '');
const fail = message => { console.error(message + '\nConsulta docs/ANDROID.md.'); process.exit(1); };

if (!env.CERRITOS_ANDROID_KEYSTORE || !existsSync(env.CERRITOS_ANDROID_KEYSTORE)) {
  fail('Falta la firma permanente para teléfonos nuevos. No se creará otra clave automáticamente.');
}

if (!env.JAVA_HOME && process.platform === 'darwin') {
  const studioJava = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  if (existsSync(join(studioJava, 'bin', 'javac'))) env.JAVA_HOME = studioJava;
}
const compiler = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', executable('javac')) : 'javac';
const java = spawnSync(compiler, ['-version'], { env, encoding: 'utf8' });
const version = (java.stdout ?? '') + (java.stderr ?? '');
if (java.status !== 0 || Number(version.match(/javac (\d+)/)?.[1] ?? 0) < 21) {
  fail('Se necesita un JDK 21 o superior. Configura JAVA_HOME con el JDK de Android Studio.');
}

if (!env.CERRITOS_ANDROID_STORE_PASSWORD || !env.CERRITOS_ANDROID_KEY_ALIAS || !env.CERRITOS_ANDROID_KEY_PASSWORD) {
  fail('Faltan las credenciales de la firma permanente.');
}
const keytool = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', executable('keytool')) : 'keytool';
const certificate = spawnSync(keytool, ['-J-Duser.language=en', '-J-Duser.country=US', '-list', '-v', '-keystore', env.CERRITOS_ANDROID_KEYSTORE,
  '-alias', env.CERRITOS_ANDROID_KEY_ALIAS, '-storepass:env', 'CERRITOS_ANDROID_STORE_PASSWORD'],
  { env, encoding: 'utf8' });
const fingerprint = certificate.stdout?.match(/SHA256:\s*([A-Fa-f0-9:]+)/)?.[1].replaceAll(':', '').toLowerCase();
const expected = env.CERRITOS_ANDROID_CERT_SHA256?.replaceAll(':', '').toLowerCase();
if (certificate.status !== 0 || !/^[a-f0-9]{64}$/.test(expected ?? '') || fingerprint !== expected || fingerprint === '6baa3ed2d319aec08aeae5a4a701bf2a0a303d5b59a07e8fd385a7cb1b64bd23') {
  fail('La clave no coincide con el certificado permanente registrado para teléfonos nuevos.');
}

const candidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT,
  join(homedir(), 'Library', 'Android', 'sdk'), join(homedir(), 'Android', 'Sdk'),
  env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Android', 'Sdk')].filter(Boolean);
const sdk = candidates.find(path => existsSync(join(path, 'platforms', 'android-36', 'android.jar')));
if (!sdk) fail('Instala Android SDK Platform 36 desde SDK Manager y configura ANDROID_HOME.');
env.ANDROID_HOME = sdk;

const result = spawnSync(isWindows ? 'gradlew.bat' : './gradlew',
  [':app:assembleRelease', '--no-daemon', '--max-workers=2', '--console=plain'],
  { cwd: join(root, 'android'), env, stdio: 'inherit', shell: isWindows });
if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);

const { version: appVersion } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const filename = `cerritos-home-${appVersion}-new-phone.apk`;
const artifacts = join(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
copyFileSync(join(root, 'android/app/build/outputs/apk/release/app-release.apk'), join(artifacts, filename));
const sha = createHash('sha256').update(readFileSync(join(artifacts, filename))).digest('hex');
writeFileSync(join(artifacts, filename + '.sha256'), `${sha}  ${filename}\n`);
const verification = spawnSync(process.execPath, ['scripts/verify-android.mjs', join(artifacts, filename)], { cwd: root, env, stdio: 'inherit' });
if (verification.status !== 0) process.exit(verification.status ?? 1);
console.log(`\nInstalación para teléfono nuevo; incompatible como actualización de las APK anteriores.\nAPK: ${join(artifacts, filename)}\nSHA256: ${sha}\n`);
