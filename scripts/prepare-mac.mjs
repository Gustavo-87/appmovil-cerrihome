import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.platform !== 'darwin') throw new Error('Ejecuta este comando en el Mac mini que alojará la aplicación.');
const escape = value => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[char]));
const cwd = process.cwd();
mkdirSync(resolve(cwd, 'artifacts'), { recursive: true });
const file = resolve(cwd, 'artifacts/com.cerritoshome.web.plist');
writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.cerritoshome.web</string>
<key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(resolve(cwd, 'scripts/serve.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${escape(cwd)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${escape(resolve(cwd,'artifacts/web.log'))}</string>
<key>StandardErrorPath</key><string>${escape(resolve(cwd,'artifacts/web-error.log'))}</string>
<key>EnvironmentVariables</key><dict><key>PORT</key><string>4173</string></dict>
</dict></plist>
`);
console.log('Archivo preparado: artifacts/com.cerritoshome.web.plist. Revísalo e instálalo según docs/PRODUCTION.md.');
