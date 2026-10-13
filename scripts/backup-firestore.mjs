import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeFirebase } from '../server/firebase.mjs';
const {db}=initializeFirebase(process.env.FIREBASE_PROJECT_ID);
const collections=['members','reservations','vehicles','incidents','booking_days','active_plates','system','audit_log','operation_receipts'];
const backup={schema:1,projectId:process.env.FIREBASE_PROJECT_ID,createdAt:new Date().toISOString(),collections:{}};
for(const name of collections){const snapshot=await db.collection(name).get();backup.collections[name]=snapshot.docs.map(row=>({id:row.id,data:row.data()}));}
const dir=resolve(process.env.FIREBASE_BACKUP_DIR||'artifacts/backups');mkdirSync(dir,{recursive:true,mode:0o700});
const file=resolve(dir,`firestore-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
writeFileSync(file,JSON.stringify(backup),{mode:0o600});
console.log('Copia guardada en el directorio privado de respaldos. No incluye contraseñas de Authentication.');await db.terminate();
