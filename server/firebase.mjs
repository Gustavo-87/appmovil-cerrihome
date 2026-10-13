import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const envFile=fileURLToPath(new URL('../.server.env',import.meta.url));
if(existsSync(envFile))process.loadEnvFile(envFile);
export function initializeFirebase(projectId) {
 if(!projectId)throw new Error('Configura FIREBASE_PROJECT_ID en .server.env.');
 const app=initializeApp({credential:applicationDefault(),projectId});
 return {db:getFirestore(app),identity:getAuth(app)};
}
