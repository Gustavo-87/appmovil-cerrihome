import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { initializeFirebase } from '../server/firebase.mjs';
import { apiHandler } from '../server/api.mjs';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const configuration = JSON.parse(await readFile(resolve(root, 'deployment.json'), 'utf8'));
if(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_PROJECT_ID!==configuration.projectId)throw new Error('El proyecto del servidor no coincide con la web.');
const api=apiHandler({...initializeFirebase(configuration.projectId),allowedOrigins:(process.env.ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean)});
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://${configuration.authDomain} ${configuration.apiOrigin}; frame-src https://${configuration.authDomain}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(await api(request,response))return;
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) throw new Error('invalid');
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || path.endsWith('deployment.json') || !(await stat(path)).isFile()) throw new Error('not found');
    response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    response.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store');
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : await readFile(path));
  } catch { response.writeHead(404); response.end('No encontrado'); }
});
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido');
server.listen(port, '127.0.0.1', () => console.log(`Cerritos Home: http://127.0.0.1:${port} · publicar con Tailscale Serve`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
