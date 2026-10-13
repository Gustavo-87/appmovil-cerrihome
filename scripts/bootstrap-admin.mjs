import { randomBytes } from 'node:crypto';
import { initializeFirebase } from '../server/firebase.mjs';
const {FIREBASE_PROJECT_ID,ADMIN_EMAIL,ADMIN_NAME}=process.env;
if(!ADMIN_EMAIL||!ADMIN_NAME)throw new Error('Configura ADMIN_EMAIL y ADMIN_NAME para autorizar al primer administrador.');
const {db,identity}=initializeFirebase(FIREBASE_PROJECT_ID);
const email=ADMIN_EMAIL.trim().toLowerCase(),name=ADMIN_NAME.trim();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>90)throw new Error('Correo o nombre inválido.');
const account=await identity.createUser({email,password:randomBytes(48).toString('base64url')+'Aa1!'});
try{
 await db.runTransaction(async tx=>{
  const ref=db.doc('system/admins'),state=await tx.get(ref);
  if(state.exists)throw new Error('Ya se inicializó el administrador. Usa la gestión de usuarios.');
  const member={id:account.uid,email,name,unit:'',role:'admin',active:true};
  tx.set(ref,{count:1});tx.set(db.doc(`members/${account.uid}`),member);
  tx.set(db.doc(`audit_log/${randomBytes(16).toString('hex')}`),{actorId:null,table:'members',recordId:account.uid,before:null,after:member,created:new Date().toISOString()});
 });
}catch(e){await identity.deleteUser(account.uid);throw e;}
console.log('Administrador autorizado. Abre la app y pulsa «Establecer o recuperar contraseña» para definirla desde tu correo.');
process.exit(0);
