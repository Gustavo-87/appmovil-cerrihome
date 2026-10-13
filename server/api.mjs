import { randomBytes } from 'node:crypto';
import { executeOperation, OperationError, publicOperations } from './operations.mjs';
export function apiHandler({db,identity,allowedOrigins}) {
 const rates=new Map();
 const timer=setInterval(()=>{const now=Date.now();for(const [key,value]of rates)if(value.until<now)rates.delete(key);},60_000);timer.unref();
 return async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(!url.pathname.startsWith('/api/'))return false;
  response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');
  const reply=(status,data)=>{response.writeHead(status);response.end(JSON.stringify(data));};
  const origin=request.headers.origin;
  if(origin&&!allowedOrigins.includes(origin)){reply(403,{error:'not_authorized'});return true;}
  if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
  if(request.method==='OPTIONS'){response.setHeader('Access-Control-Allow-Headers','authorization, content-type');response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');reply(204,null);return true;}
  try{
   const token=request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new OperationError('not_authorized',401);
   let user;try{user=await identity.verifyIdToken(token,true);}catch{throw new OperationError('not_authorized',401);}
   let rate=rates.get(user.uid);if(!rate||rate.until<Date.now()){rate={count:0,until:Date.now()+60_000};rates.set(user.uid,rate);}if(++rate.count>100)throw new OperationError('rate_limited',429);
   const member=(await db.doc(`members/${user.uid}`).get()).data();
   if(!member?.active||!['admin','guard'].includes(member.role))throw new OperationError('not_authorized',403);
   if(url.pathname==='/api/users'&&request.method==='GET'){
    if(member.role!=='admin')throw new OperationError('not_authorized',403);
    const users=await db.collection('members').orderBy('name').get();reply(200,users.docs.map(row=>({...row.data(),id:row.id})));return true;
   }
   if(request.method!=='POST')throw new OperationError('invalid_input',405);
   let raw='';for await(const chunk of request){raw+=chunk.toString();if(Buffer.byteLength(raw)>8192)throw new OperationError('invalid_input',413);}
   let body;try{body=JSON.parse(raw);}catch{throw new OperationError('invalid_input');}
   if(!body||typeof body!=='object'||Array.isArray(body))throw new OperationError('invalid_input');
   if(url.pathname==='/api/users'){
    if(member.role!=='admin')throw new OperationError('not_authorized',403);
    if(typeof body.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())||body.email.length>254||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>90||!['admin','guard'].includes(body.role))throw new OperationError('invalid_input');
    let account;try{account=await identity.createUser({email:body.email.trim().toLowerCase(),password:randomBytes(48).toString('base64url')+'Aa1!'});}catch(e){if(e.code==='auth/email-already-exists')throw new OperationError('account_exists',409);throw e;}
    try{const result=await executeOperation(db,user.uid,'create_member',{p_id:account.uid,p_email:account.email,p_name:body.name,p_role:body.role,p_active:true});reply(201,result);}
    catch(e){try{await identity.deleteUser(account.uid);}catch{/* Without membership the orphan account has no data access. */}throw e;}
    return true;
   }
   const name=url.pathname.split('/').at(-1);
   if(!url.pathname.startsWith('/api/operations/')||!publicOperations.includes(name))throw new OperationError('invalid_input',404);
   reply(200,await executeOperation(db,user.uid,name,body));
  }catch(e){reply(e instanceof OperationError?e.status:503,{error:e instanceof OperationError?e.code:'service_unavailable'});}
  return true;
 };
}
