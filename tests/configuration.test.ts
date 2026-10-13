import { describe, expect, it } from 'vitest';
import { productionConfiguration } from '../scripts/configuration.mjs';
const env={VITE_FIREBASE_API_KEY:'public-key',VITE_FIREBASE_AUTH_DOMAIN:'demo.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'demo-cerritos',VITE_FIREBASE_APP_ID:'public-app',VITE_DEMO_MODE:'false'};
describe('Configuración Firebase',()=>{
 it('requiere el proyecto y bloquea demostración',()=>{expect(()=>productionConfiguration({})).toThrow('Firebase');expect(()=>productionConfiguration({...env,VITE_DEMO_MODE:'true'})).toThrow('demostración');});
 it('usa el mismo origen web o una API HTTPS para Android',()=>{expect(productionConfiguration(env).apiOrigin).toBe('');expect(productionConfiguration({...env,VITE_API_ORIGIN:'https://mac.example.ts.net'}).apiOrigin).toBe('https://mac.example.ts.net');});
 it('rechaza rutas, credenciales y API sin HTTPS',()=>{for(const url of ['http://mac.example.com','https://user:pass@mac.example.com','https://mac.example.com/api','https://mac.example.com?x=1'])expect(()=>productionConfiguration({...env,VITE_API_ORIGIN:url})).toThrow('HTTPS');});
});
