import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const apk = process.argv[2];
if (!apk) throw new Error('Indica la APK');
const tools = join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '', 'build-tools', '36.0.0');
const signed = execFileSync(join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' });
const actual = signed.match(/Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]+)/)?.[1].toLowerCase();
const expected = process.env.CERRITOS_ANDROID_CERT_SHA256?.replaceAll(':', '').toLowerCase();
if (!/^[a-f0-9]{64}$/.test(expected ?? '') || actual !== expected || actual === '6baa3ed2d319aec08aeae5a4a701bf2a0a303d5b59a07e8fd385a7cb1b64bd23' || /Signer #2 certificate/.test(signed)) throw new Error('Certificado incorrecto');
const badging = execFileSync(join(tools, 'aapt'), ['dump', 'badging', apk], { encoding: 'utf8' });
const pkg = badging.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg || pkg[1] !== 'com.cerritoshome.app' || pkg[2] !== '8' || pkg[3] !== version || /application-debuggable/.test(badging)) throw new Error('Identidad, versión o modo de compilación incorrectos');
const deployment = JSON.parse(execFileSync('unzip', ['-p', apk, 'assets/public/deployment.json'], { encoding: 'utf8' }));
if (deployment.projectId !== 'app-cerritoshome' || deployment.authDomain !== 'app-cerritoshome.firebaseapp.com' || deployment.apiOrigin !== 'https://mac-mini.tail653cc7.ts.net') throw new Error('La APK no conserva la configuración Firebase y API actuales');
const proof = { applicationId: pkg[1], versionName: pkg[3], versionCode: Number(pkg[2]), certificateSHA256: actual,
  apkSHA256: createHash('sha256').update(readFileSync(apk)).digest('hex'), firebaseProject: deployment.projectId, apiOrigin: deployment.apiOrigin,
  installation: 'Instalación para teléfono nuevo; incompatible como actualización de las APK anteriores.' };
writeFileSync(apk + '.verification.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
