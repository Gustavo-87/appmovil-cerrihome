import { loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { productionConfiguration } from './configuration.mjs';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const configuration = productionConfiguration(env);
const result = spawnSync('npm', ['run','build'], { stdio: 'inherit', env });
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync('dist/deployment.json', JSON.stringify({ ...configuration, builtAt: new Date().toISOString() }));
console.log('Compilación preparada para publicar. La conexión y el acceso Firebase deben verificarse contra tu proyecto real.');
