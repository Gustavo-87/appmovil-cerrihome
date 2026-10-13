import { openDB } from 'idb';
import type { Area, Data } from './domain';

export const offlineOperations = ['create_reservation','cancel_reservation','enter_vehicle','exit_vehicle','create_incident','resolve_incident'] as const;
export type OperationName = typeof offlineOperations[number];
export type QueuedOperation = { id: string; uid: string; sequence: number; name: OperationName; args: Record<string, unknown>; occurredAt: string; status: 'pending' | 'confirmed' | 'failed'; error?: string };
const database = () => openDB('cerritos-offline-v1',1,{upgrade(db){const store=db.createObjectStore('outbox',{keyPath:['uid','id']});store.createIndex('uid','uid');}});
function changed(uid: string) { if(typeof window !== 'undefined')window.dispatchEvent(new CustomEvent('cerritos-outbox-changed',{detail:uid})); }
export async function getQueue(uid: string): Promise<QueuedOperation[]> {
  const db=await database();try{return (await db.getAllFromIndex('outbox','uid',uid)).sort((a,b)=>a.sequence-b.sequence);}finally{db.close();}
}
export async function enqueue(uid: string, name: OperationName, args: Record<string,unknown>): Promise<QueuedOperation> {
  if(!offlineOperations.includes(name))throw new Error('Operación no disponible sin conexión');
  const db=await database();
  try{
    const tx=db.transaction('outbox','readwrite'),prior=await tx.store.index('uid').getAll(uid);
    const entry:QueuedOperation={id:crypto.randomUUID(),uid,name,args,sequence:Math.max(0,...prior.map(x=>x.sequence))+1,occurredAt:new Date().toISOString(),status:'pending'};
    await tx.store.put(entry);await tx.done;changed(uid);return entry;
  }finally{db.close();}
}
export async function updateQueued(entry: QueuedOperation) {const db=await database();try{await db.put('outbox',entry);}finally{db.close();}changed(entry.uid);}
export async function removeQueued(uid: string,id: string) {const db=await database();try{await db.delete('outbox',[uid,id]);}finally{db.close();}changed(uid);}

export function reconciled(entry: QueuedOperation,data: Data) {
  if(entry.status!=='confirmed')return false;
  const p=entry.args;
  switch(entry.name){
    case 'create_reservation':return data.reservations.some(r=>r.id===entry.id);
    case 'enter_vehicle':return data.vehicles.some(v=>v.id===entry.id);
    case 'create_incident':return data.incidents.some(i=>i.id===entry.id);
    case 'cancel_reservation':return data.reservations.some(r=>r.id===p.p_id&&r.cancelled);
    case 'exit_vehicle':return data.vehicles.some(v=>v.id===p.p_id&&v.exited!==null);
    case 'resolve_incident':return data.incidents.some(i=>i.id===p.p_id&&i.resolved===p.p_resolved);
  }
}
export function projectQueue(base: Data,queue: QueuedOperation[]): Data {
  let data:Data={reservations:[...base.reservations],vehicles:[...base.vehicles],incidents:[...base.incidents]};
  for(const entry of queue){
    if(entry.status==='failed'||reconciled(entry,base))continue;
    const p=entry.args,syncStatus=entry.status==='pending'?'pending' as const:undefined;
    if(entry.name==='create_reservation'&&!data.reservations.some(r=>r.id===entry.id))data.reservations.push({id:entry.id,ownerId:entry.uid,resident:String(p.p_resident),unit:String(p.p_unit),area:p.p_area as Area,date:String(p.p_date),start:String(p.p_start),end:String(p.p_end),notes:String(p.p_notes??''),cancelled:false,syncStatus});
    if(entry.name==='cancel_reservation')data.reservations=data.reservations.map(r=>r.id===p.p_id?{...r,cancelled:true,syncStatus}:r);
    if(entry.name==='enter_vehicle'){
      if(!data.vehicles.some(v=>v.id===entry.id))data.vehicles.unshift({id:entry.id,plate:String(p.p_plate),driver:String(p.p_driver),unit:String(p.p_unit),reason:String(p.p_reason),entered:entry.occurredAt,exited:null,syncStatus});
      if(p.p_note&&!data.incidents.some(i=>i.id===`${entry.id}-note`))data.incidents.unshift({id:`${entry.id}-note`,ownerId:entry.uid,title:`Novedad de ingreso · ${p.p_plate}`,description:String(p.p_note),category:'Vehículo',vehicleId:entry.id,created:entry.occurredAt,resolved:false,syncStatus});
    }
    if(entry.name==='exit_vehicle')data.vehicles=data.vehicles.map(v=>v.id===p.p_id?{...v,exited:entry.occurredAt,syncStatus}:v);
    if(entry.name==='create_incident'&&!data.incidents.some(i=>i.id===entry.id))data.incidents.unshift({id:entry.id,ownerId:entry.uid,title:String(p.p_title),description:String(p.p_description),category:String(p.p_category),vehicleId:p.p_vehicle_id?String(p.p_vehicle_id):undefined,created:entry.occurredAt,resolved:false,syncStatus});
    if(entry.name==='resolve_incident')data.incidents=data.incidents.map(i=>i.id===p.p_id?{...i,resolved:Boolean(p.p_resolved),syncStatus}:i);
  }
  return data;
}
const running=new Map<string,Promise<void>>();
export function synchronize(uid: string,send:(entry:QueuedOperation)=>Promise<unknown>,isActive:()=>boolean=()=>true):Promise<void>{
  if(running.has(uid))return running.get(uid)!;
  const action=async()=>{
    for(const entry of await getQueue(uid)){
      if(!isActive())break;
      if(entry.status!=='pending')continue;
      try{await send(entry);await updateQueued({...entry,status:'confirmed',error:undefined});}
      catch(e){
        const code=(e as {code?:string})?.code;
        if(!code||['network_error','service_unavailable','rate_limited','auth/network-request-failed','auth/user-token-expired','not_authorized','origin_not_allowed','server_update_required'].includes(code)){await updateQueued({...entry,error:code??'network_error'});break;}
        await updateQueued({...entry,status:'failed',error:code});
      }
    }
  };
  const task=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request(`cerritos-sync-${uid}`,action):action()).finally(()=>running.delete(uid));
  running.set(uid,task);return task;
}
