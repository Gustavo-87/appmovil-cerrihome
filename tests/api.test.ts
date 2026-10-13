import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { apiHandler } from '../server/api.mjs';

let server: Server, url: string;
const members: Record<string, any> = { admin:{id:'admin',name:'Admin',role:'admin',active:true},guard:{id:'guard',name:'Guard',role:'guard',active:true},inactive:{id:'inactive',role:'admin',active:false} };
const identity={verifyIdToken:async(token:string,checkRevoked:boolean)=>{if(!checkRevoked)throw new Error('must verify revocation');if(token==='invalid')throw new Error('bad token');return {uid:token};},createUser:async()=>{throw new Error('unexpected account creation');}};
const db={doc:(path:string)=>({get:async()=>({data:()=>members[path.split('/')[1]]})}),collection:()=>({orderBy:()=>({get:async()=>({docs:Object.values(members).map(data=>({id:data.id,data:()=>data}))})})})};
beforeAll(async()=>{
 const handler=apiHandler({db,identity,allowedOrigins:['https://mac.example.ts.net']});
 server=createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 url=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('Protección HTTP de la API del Mac',()=>{
 it('rechaza peticiones sin token y tokens inválidos',async()=>{
  expect((await fetch(url+'/api/users')).status).toBe(401);
  expect((await fetch(url+'/api/users',{headers:{Authorization:'Bearer invalid'}})).status).toBe(401);
 });
 it('no acepta una cuenta de Firebase sin miembro ni una cuenta desactivada',async()=>{
  for(const user of ['unknown','inactive'])expect((await fetch(url+'/api/users',{headers:{Authorization:`Bearer ${user}`}})).status).toBe(403);
 });
 it('solo administración consulta o crea cuentas; el rol del cuerpo no otorga permiso',async()=>{
  expect((await fetch(url+'/api/users',{headers:{Authorization:'Bearer guard'}})).status).toBe(403);
  expect((await fetch(url+'/api/users',{method:'POST',headers:{Authorization:'Bearer guard','Content-Type':'application/json'},body:JSON.stringify({role:'admin'})})).status).toBe(403);
  const response=await fetch(url+'/api/users',{headers:{Authorization:'Bearer admin'}});expect(response.status).toBe(200);expect((await response.json()).length).toBe(3);
 });
 it('bloquea orígenes externos y acepta solo el origen configurado',async()=>{
  expect((await fetch(url+'/api/users',{headers:{Authorization:'Bearer admin',Origin:'https://unknown.example.com'}})).status).toBe(403);
  const response=await fetch(url+'/api/users',{headers:{Authorization:'Bearer admin',Origin:'https://mac.example.ts.net'}});expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe('https://mac.example.ts.net');
 });
});
