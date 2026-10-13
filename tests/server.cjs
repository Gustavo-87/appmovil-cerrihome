const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4183' }, stdio: ['ignore','pipe','pipe'] });
  try {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('El servidor no inició')), 10_000);
      server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`El servidor terminó: ${code}`)); });
    });
    const origin = 'http://127.0.0.1:4183';
    const root = await fetch(origin);
    assert.equal(root.status,200);
    const html = await root.text();
    assert.ok(html.includes('<div id="root"></div>'));
    assert.ok(root.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    assert.equal(root.headers.get('x-content-type-options'),'nosniff');
    assert.equal(root.headers.get('cache-control'),'no-store');
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
    const js = await fetch(origin+asset);
    assert.equal(js.status,200);
    assert.ok(js.headers.get('cache-control').includes('immutable'));
    for (const path of ['/.env.local','/deployment.json','/%2e%2e/.env','/unknown']) assert.equal((await fetch(origin+path)).status,404);
    assert.equal((await fetch(origin,{method:'POST'})).status,405);
    assert.equal((await fetch(origin,{method:'HEAD'})).status,200);
    console.log('PASS: servidor estático, cabeceras, assets, bloqueo de archivos de configuración y métodos');
  } finally { server.kill('SIGTERM'); }
})().catch(e => { console.error(e); process.exit(1); });
