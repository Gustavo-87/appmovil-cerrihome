import { createHash, randomUUID } from 'node:crypto';
export class OperationError extends Error { constructor(code, status=400) { super(code); this.code=code; this.status=status; } }
const fail = (code, status) => { throw new OperationError(code,status); };
const text = (value,max,required=true) => { if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail('invalid_input');return value.trim(); };
const key = value => { if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(value))fail('invalid_input');return value; };
const roles = ['admin','guard'];
const zones = ['Salón social','Gimnasio','Golfito'];
const categories = ['General','Vehículo','Mantenimiento','Seguridad','Espacios comunes'];
export const publicOperations = ['authorize_member','create_reservation','cancel_reservation','enter_vehicle','exit_vehicle','create_incident','resolve_incident'];
export async function executeOperation(db, uid, operation, p, clock=()=>new Date()) {
  if(![...publicOperations,'create_member'].includes(operation))fail('invalid_input');
  const now=clock();
  const requestId=p._requestId;
  if(requestId!==undefined&&(typeof requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)))fail('invalid_input');
  if(p._occurredAt!==undefined&&typeof p._occurredAt!=='string')fail('invalid_input');
  const occurredAt=p._occurredAt===undefined?now:new Date(p._occurredAt);
  if(!Number.isFinite(occurredAt.getTime())||occurredAt.getTime()>now.getTime()+300_000)fail('invalid_input');
  const payloadHash=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(p).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
  return db.runTransaction(async tx => {
    const memberRef=db.doc(`members/${key(uid)}`);
    const member=(await tx.get(memberRef)).data();
    if(!member?.active||!roles.includes(member.role))fail('not_authorized',403);
    const receiptRef=requestId?db.doc(`operation_receipts/${uid}_${requestId}`):null;
    if(receiptRef){const receipt=(await tx.get(receiptRef)).data();if(receipt){if(receipt.operation!==operation||receipt.payloadHash!==payloadHash)fail('invalid_input');return receipt.result;}}
    const finish=result=>{if(receiptRef)tx.set(receiptRef,{operation,payloadHash,result:result??null,created:now.toISOString(),actorId:uid});return result;};
    const audit=(table,id,before,after)=>tx.set(db.doc(`audit_log/${randomUUID()}`),{actorId:uid,table,recordId:id,before:before??null,after,created:now.toISOString()});
    if(operation==='authorize_member'||operation==='create_member') {
      if(member.role!=='admin')fail('not_authorized',403);
      const id=key(p.p_id),ref=db.doc(`members/${id}`),prior=(await tx.get(ref)).data();
      if(operation==='create_member'?Boolean(prior):!prior)fail('invalid_input');
      const email=text(p.p_email,254).toLowerCase(),name=text(p.p_name,90),role=p.p_role,active=p.p_active;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role)||typeof active!=='boolean'||(prior&&prior.email!==email))fail('invalid_input');
      const adminRef=db.doc('system/admins'),state=(await tx.get(adminRef)).data();
      if(!Number.isInteger(state?.count)||state.count<1)fail('configuration_error',503);
      const nextCount=state.count+(role==='admin'&&active?1:0)-(prior?.role==='admin'&&prior.active?1:0);
      if(nextCount<1)fail('last_admin');
      const next={id,email,name,unit:'',role,active};
      tx.set(adminRef,{count:nextCount});tx.set(ref,next);audit('members',id,prior,next);return finish(next);
    }
    if(operation==='create_reservation') {
      const resident=text(p.p_resident,90),unit=text(p.p_unit,40),notes=text(p.p_notes??'',1000,false);
      const block=p.p_block===undefined&&requestId?undefined:text(p.p_block,40);
      if(block!==undefined&&!/^\d+$/.test(unit))fail('invalid_input');
      const date=p.p_date,start=p.p_start,end=p.p_end,area=p.p_area;
      const validTime=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
      const dateValue=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(`${date}T12:00:00Z`):new Date(NaN);
      const localNow=new Date(now.getTime()-5*3600_000).toISOString().slice(0,16);
      if(!Number.isFinite(dateValue.getTime())||dateValue.toISOString().slice(0,10)!==date||!validTime(start)||!validTime(end)||start>=end||!zones.includes(area)||`${date}T${start}`<=localNow)fail('invalid_input');
      const dayRef=db.doc(`booking_days/${date}_${zones.indexOf(area)}`),day=(await tx.get(dayRef)).data()??{slots:[]};
      if(day.slots.some(slot=>start<slot.end&&end>slot.start))fail('reservation_conflict',409);
      const id=requestId??randomUUID(),row={id,ownerId:uid,resident,unit,...(block===undefined?{}:{block}),area,date,start,end,notes,cancelled:false};
      if(requestId&&(await tx.get(db.doc(`reservations/${id}`))).exists)fail('invalid_input');
      tx.set(dayRef,{slots:[...day.slots,{id,start,end}]});tx.set(db.doc(`reservations/${id}`),row);audit('reservations',id,null,row);return finish(id);
    }
    if(operation==='cancel_reservation') {
      const id=key(p.p_id),ref=db.doc(`reservations/${id}`),prior=(await tx.get(ref)).data();
      if(!prior)fail('invalid_input');
      const dayRef=db.doc(`booking_days/${prior.date}_${zones.indexOf(prior.area)}`),day=(await tx.get(dayRef)).data()??{slots:[]};
      const next={...prior,cancelled:true};tx.set(dayRef,{slots:day.slots.filter(slot=>slot.id!==id)});tx.set(ref,next);audit('reservations',id,prior,next);return finish(null);
    }
    if(operation==='enter_vehicle') {
      const plate=text(p.p_plate,10).toUpperCase(),driver=text(p.p_driver,90),unit=text(p.p_unit,40),reason=p.p_reason,note=text(p.p_note??'',1000,false);
      if(!/^[A-Z0-9-]{4,10}$/.test(plate)||!['Visita','Domicilio','Servicio técnico','Proveedor','Otro'].includes(reason))fail('invalid_input');
      const plateRef=db.doc(`active_plates/${plate}`);if((await tx.get(plateRef)).exists)fail('duplicate_vehicle',409);
      const id=requestId??randomUUID(),row={id,plate,driver,unit,reason,entered:occurredAt.toISOString(),exited:null};
      if(requestId&&(await tx.get(db.doc(`vehicles/${id}`))).exists)fail('invalid_input');
      if(requestId&&note&&(await tx.get(db.doc(`incidents/${requestId}-note`))).exists)fail('invalid_input');
      tx.set(plateRef,{vehicleId:id});tx.set(db.doc(`vehicles/${id}`),row);audit('vehicles',id,null,row);
      if(note){const incidentId=requestId?`${requestId}-note`:randomUUID(),incident={id:incidentId,ownerId:uid,title:`Novedad de ingreso · ${plate}`,description:note,category:'Vehículo',vehicleId:id,created:occurredAt.toISOString(),resolved:false};tx.set(db.doc(`incidents/${incidentId}`),incident);audit('incidents',incidentId,null,incident);}
      return finish(id);
    }
    if(operation==='exit_vehicle') {
      const id=key(p.p_id),ref=db.doc(`vehicles/${id}`),prior=(await tx.get(ref)).data();if(!prior||prior.exited)fail('invalid_input');
      const plateRef=db.doc(`active_plates/${prior.plate}`),active=(await tx.get(plateRef)).data();if(active?.vehicleId!==id)fail('configuration_error',503);
      if(occurredAt.toISOString()<prior.entered)fail('invalid_input');
      const next={...prior,exited:occurredAt.toISOString()};tx.delete(plateRef);tx.set(ref,next);audit('vehicles',id,prior,next);return finish(null);
    }
    if(operation==='create_incident') {
      const title=text(p.p_title,120),description=text(p.p_description,2000),category=p.p_category;
      if(!categories.includes(category))fail('invalid_input');
      const vehicleId=p.p_vehicle_id??null;if(vehicleId&&!(await tx.get(db.doc(`vehicles/${key(vehicleId)}`))).exists)fail('invalid_input');
      const id=requestId??randomUUID(),row={id,ownerId:uid,title,description,category,...(vehicleId?{vehicleId}:{}),created:occurredAt.toISOString(),resolved:false};
      if(requestId&&(await tx.get(db.doc(`incidents/${id}`))).exists)fail('invalid_input');
      tx.set(db.doc(`incidents/${id}`),row);audit('incidents',id,null,row);return finish(id);
    }
    if(operation==='resolve_incident') {
      const id=key(p.p_id),ref=db.doc(`incidents/${id}`),prior=(await tx.get(ref)).data();if(!prior||typeof p.p_resolved!=='boolean')fail('invalid_input');
      const next={...prior,resolved:p.p_resolved};tx.set(ref,next);audit('incidents',id,prior,next);return finish(null);
    }
  });
}
