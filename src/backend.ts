import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocsFromServer, getDocsFromCache, getDocFromServer, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, onSnapshot } from 'firebase/firestore';
import type { Data } from './domain';
import { enqueue, getQueue, offlineOperations, projectQueue, reconciled, removeQueued, synchronize, updateQueued, type OperationName, type QueuedOperation } from './offline';
import type { Profile } from './permissions';

export const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const app = !demoMode && Object.values(config).every(Boolean) ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : null;
const apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/$/, '');
export const emptyData: Data = { reservations: [], vehicles: [], incidents: [] };

export function backendError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if(['QuotaExceededError','InvalidStateError'].includes((error as {name?:string})?.name??''))return 'No se pudo guardar en este dispositivo. Libera espacio o habilita el almacenamiento y reintenta antes de cerrar la app.';
  if(code==='origin_not_allowed')return 'El servidor debe habilitar el acceso de esta app. Contacta a administración; los registros locales se conservan.';
  if(code==='server_update_required')return 'Actualiza y reinicia el servidor del Mac para sincronizar esta versión Android. Los registros locales se conservan.';
  if(code==='offline_initial_login')return 'Conecta el teléfono a Internet para preparar el primer acceso y descargar los datos.';
  if(code==='offline_admin')return 'La gestión de cuentas necesita conexión con el servidor.';
  if(code==='network_error')return 'Sin conexión con el servidor. Los registros pendientes permanecen guardados en este dispositivo.';
  if (code === 'reservation_conflict') return 'Esta zona ya está reservada en ese horario. Elige otro horario.';
  if (code === 'duplicate_vehicle') return 'Este vehículo ya tiene un ingreso activo.';
  if (code === 'account_exists') return 'Ese correo ya tiene una cuenta. Revisa las personas autorizadas.';
  if (code === 'not_authorized' || code === 'permission-denied') return 'Tu cuenta no tiene permiso para esta operación.';
  if (code === 'last_admin') return 'Debe permanecer al menos un administrador activo.';
  if (code === 'invalid_input') return 'Revisa los datos, la fecha y el horario.';
  return 'No se pudo completar la operación. Comprueba tu conexión e intenta nuevamente.';
}
async function api<T>(path: string, body?: unknown, expectedUid?: string): Promise<T> {
  if (!auth?.currentUser || (expectedUid&&auth.currentUser.uid!==expectedUid)) throw { code: 'not_authorized' };
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw {code:'network_error'};
  const token = await auth.currentUser.getIdToken();
  if(expectedUid&&auth.currentUser?.uid!==expectedUid)throw {code:'not_authorized'};
  let response:Response;
  try{response = await fetch(`${apiOrigin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });}catch{throw {code:'network_error'};}
  const data = await response.json();
  if (!response.ok) throw { code: path==='sync-status'&&[404,405].includes(response.status)?'server_update_required':data.error };
  return data as T;
}
export async function rpc<T>(name: string, args?: Record<string,unknown>):Promise<T>{
  if(!offlineOperations.includes(name as OperationName))return api<T>(`operations/${encodeURIComponent(name)}`,args??{});
  const uid=auth?.currentUser?.uid;if(!uid)throw {code:'not_authorized'};
  const entry=await enqueue(uid,name as OperationName,args??{});
  void syncPending(uid).catch(()=>{});
  return {queued:true,id:entry.id} as T;
}
export function syncPending(uid:string){
  let checked=false;
  return synchronize(uid,async entry=>{
    if(!checked){const status=await api<{offlineProtocol?:number}>('sync-status',undefined,uid);if(status.offlineProtocol!==1)throw {code:'server_update_required'};checked=true;}
    return api(`operations/${entry.name}`,{...entry.args,_requestId:entry.id,_occurredAt:entry.occurredAt},uid);
  },()=>auth?.currentUser?.uid===uid&&navigator.onLine);
}
export { getQueue, removeQueued };
export async function retryQueued(entry:QueuedOperation){await updateQueued({...entry,status:'pending',error:undefined});await syncPending(entry.uid);}
export function watchQueue(uid:string,callback:(queue:QueuedOperation[])=>void){
  let closed=false;const update=()=>void getQueue(uid).then(rows=>{if(!closed)callback(rows);}).catch(()=>{});
  const listener=(e:Event)=>{if((e as CustomEvent).detail===uid)update();};window.addEventListener('cerritos-outbox-changed',listener);update();
  return()=>{closed=true;window.removeEventListener('cerritos-outbox-changed',listener);};
}
export const listProfiles = () => api<Profile[]>('users');
export const createAccount = (values: Omit<Profile, 'id'>) => api<Profile>('users', values);
export async function fetchProfile(): Promise<Profile | null> {
  if (!db || !auth?.currentUser) return null;
  const snapshot = await getDoc(doc(db, 'members', auth.currentUser.uid));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Profile : null;
}
export function watchProfile(id: string, onData: (profile: Profile | null) => void, onError: (e: unknown) => void) {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'members', id), snapshot => {if(!snapshot.exists()&&snapshot.metadata.fromCache){onError({code:'offline_initial_login'});return;}onData(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Profile : null);}, onError);
}
export async function fetchData(): Promise<Data> {
  if (!db) throw new Error('Firebase no configurado');
  const names = ['reservations', 'vehicles', 'incidents'] as const;
  const result = await Promise.all(names.map(async name => {const ref=collection(db,name);try{return navigator.onLine?await getDocsFromServer(ref):await getDocsFromCache(ref);}catch{return getDocsFromCache(ref);}}));
  const base=Object.fromEntries(result.map((snapshot, index) => [names[index], snapshot.docs.map(row => ({ ...row.data(), id: row.id }))])) as Data;
  const uid=auth?.currentUser?.uid;return uid?projectQueue(base,await getQueue(uid)):base;
}
export function subscribeData(onData: (data: Data) => void, onError: (error: unknown) => void) {
  if (!db) return () => {};
  const data: Data = { reservations: [], vehicles: [], incidents: [] };
  const ready = new Set<string>();
  let closed = false;
  const uid=auth?.currentUser?.uid;if(!uid)return()=>{};
  let queue:QueuedOperation[]=[];
  const emit=()=>{if(!closed&&ready.size===3)onData(projectQueue(data,queue));};
  const verifying=new Set<string>();
  const reconcile=()=>{
    for(const entry of queue){
      if(reconciled(entry,data)){void removeQueued(uid,entry.id);continue;}
      if(entry.status!=='confirmed'||verifying.has(entry.id)||!navigator.onLine)continue;
      const table=entry.name.includes('reservation')?'reservations':entry.name==='enter_vehicle'||entry.name==='exit_vehicle'?'vehicles':'incidents';
      const target=entry.name==='create_reservation'||entry.name==='enter_vehicle'||entry.name==='create_incident'?entry.id:String(entry.args.p_id);
      verifying.add(entry.id);
      void getDocFromServer(doc(db!,table,target)).then(snapshot=>{
        if(closed||auth?.currentUser?.uid!==uid||!snapshot.exists())return;
        const row={...snapshot.data(),id:snapshot.id};
        Object.assign(data,{[table]:[...data[table].filter(item=>item.id!==target),row]});
        void removeQueued(uid,entry.id);emit();
      }).catch(()=>{}).finally(()=>verifying.delete(entry.id));
    }
  };
  const stopQueue=watchQueue(uid,rows=>{queue=rows;reconcile();emit();});
  const trigger=()=>void syncPending(uid).catch(()=>{});
  window.addEventListener('online',trigger);
  const timer=setInterval(()=>{if(document.visibilityState!=='hidden')trigger();},15000);trigger();
  const stops = (['reservations','vehicles','incidents'] as const).map(name => onSnapshot(collection(db, name), {includeMetadataChanges:true}, snapshot => {
    if (closed) return;
    Object.assign(data, { [name]: snapshot.docs.map(row => ({ ...row.data(), id: row.id })) });
    ready.add(name);
    reconcile();emit();
  }, error => { if (!closed) onError(error); }));
  return () => { closed = true;stopQueue();clearInterval(timer);window.removeEventListener('online',trigger);stops.forEach(stop => stop()); };
}
