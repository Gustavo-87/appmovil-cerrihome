export function productionConfiguration(env) {
 const names=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID'];
 if(names.some(name=>!env[name]))throw new Error('Configura Firebase en .env.local.');
 if(env.VITE_DEMO_MODE==='true')throw new Error('El modo demostración debe estar deshabilitado para producción.');
 if(!/^[a-z][a-z0-9-]{4,29}$/.test(env.VITE_FIREBASE_PROJECT_ID)||! /^[A-Za-z0-9.-]+$/.test(env.VITE_FIREBASE_AUTH_DOMAIN))throw new Error('Configuración Firebase inválida.');
 let apiOrigin=(env.VITE_API_ORIGIN||'').trim();
 if(apiOrigin){const url=new URL(apiOrigin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('La API debe usar un origen HTTPS sin credenciales ni rutas.');apiOrigin=url.origin;}
 return {projectId:env.VITE_FIREBASE_PROJECT_ID,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,apiOrigin};
}
