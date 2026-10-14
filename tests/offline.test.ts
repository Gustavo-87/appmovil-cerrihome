import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import { enqueue,getQueue,projectQueue,synchronize,updateQueued,reconciled,removeQueued } from '../src/offline';
const empty={reservations:[],vehicles:[],incidents:[]};
const reservation={p_resident:'Ana',p_unit:'Casa 1',p_area:'Golfito',p_date:'2099-01-01',p_start:'10:00',p_end:'11:00',p_notes:''};
describe('Registros locales persistentes y sincronización',()=>{
 it('persisten en IndexedDB, se consultan de nuevo y se aíslan por usuario',async()=>{
  const entry=await enqueue('local-a','create_reservation',reservation);
  expect((await getQueue('local-a'))[0].id).toBe(entry.id);
  expect(await getQueue('local-b')).toEqual([]);
  expect(projectQueue(empty,await getQueue('local-a')).reservations[0]).toMatchObject({id:entry.id,syncStatus:'pending',area:'Golfito'});
 });
 it('guarda ingreso, salida y novedad vinculada sin conexión en orden',async()=>{
  const entry=await enqueue('local-c','enter_vehicle',{p_plate:'ABC123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',p_note:'Rayón'});
  await enqueue('local-c','exit_vehicle',{p_id:entry.id});
  const data=projectQueue(empty,await getQueue('local-c'));
  expect(data.vehicles[0].exited).not.toBeNull();expect(data.vehicles[0].syncStatus).toBe('pending');
  expect(data.incidents[0].vehicleId).toBe(entry.id);expect(data.incidents[0].id).toBe(`${entry.id}-note`);
 });
 it('un corte durante el envío conserva el registro y reutiliza su identificador',async()=>{
  const entry=await enqueue('local-d','create_incident',{p_title:'Prueba',p_description:'Texto',p_category:'General'});
  await synchronize('local-d',async()=>{throw {code:'network_error'};});
  expect((await getQueue('local-d'))[0]).toMatchObject({id:entry.id,status:'pending'});
  let sent='';await synchronize('local-d',async op=>{sent=op.id;});
  expect(sent).toBe(entry.id);expect((await getQueue('local-d'))[0].status).toBe('confirmed');
 });
 it('marca un conflicto de reserva para revisión sin mostrarla confirmada',async()=>{
  await enqueue('local-e','create_reservation',reservation);
  await synchronize('local-e',async()=>{throw {code:'reservation_conflict'};});
  const queue=await getQueue('local-e');expect(queue[0].status).toBe('failed');expect(projectQueue(empty,queue).reservations).toEqual([]);
 });
 it('un servidor antiguo conserva todo pendiente hasta actualizarlo',async()=>{
  await enqueue('local-f','create_reservation',reservation);
  await synchronize('local-f',async()=>{throw {code:'server_update_required'};});
  expect((await getQueue('local-f'))[0]).toMatchObject({status:'pending',error:'server_update_required'});
 });
 it('no descarta registros ante una revocación ni los envía con otra sesión',async()=>{
  await enqueue('local-g','create_reservation',reservation);
  await synchronize('local-g',async()=>{throw {code:'not_authorized'};});
  expect((await getQueue('local-g'))[0].status).toBe('pending');
  let sent=false;await synchronize('local-g',async()=>{sent=true;},()=>false);expect(sent).toBe(false);
 });
 it('reconcilia un registro confirmado por Firestore sin duplicarlo',async()=>{
  const entry=await enqueue('local-h','create_reservation',reservation);
  const confirmed={...entry,status:'confirmed' as const};await updateQueued(confirmed);
  const data=projectQueue(empty,[confirmed]);expect(reconciled(confirmed,data)).toBe(true);
  expect(projectQueue(data,[confirmed]).reservations).toHaveLength(1);
  await removeQueued('local-h',entry.id);expect(await getQueue('local-h')).toEqual([]);
 });
 it('las cancelaciones y resoluciones locales permanecen pendientes hasta confirmarse',async()=>{
  const entry=await enqueue('local-i','create_incident',{p_title:'Prueba',p_description:'Texto',p_category:'General'});
  await enqueue('local-i','resolve_incident',{p_id:entry.id,p_resolved:true});
  expect(projectQueue(empty,await getQueue('local-i')).incidents[0]).toMatchObject({resolved:true,syncStatus:'pending'});
 });
});

it('conserva un envío que supera el tiempo de espera para reintentar con el mismo ID',async()=>{
 const entry=await enqueue('timeout-regression','create_incident',{p_title:'Prueba',p_description:'Texto',p_category:'General'});
 await synchronize(entry.uid,async()=>{throw {code:'request_timeout'};});
 expect((await getQueue(entry.uid))[0]).toMatchObject({id:entry.id,status:'pending',error:'request_timeout'});
 await synchronize(entry.uid,async op=>{expect(op.id).toBe(entry.id);});
 expect((await getQueue(entry.uid))[0].status).toBe('confirmed');
});
