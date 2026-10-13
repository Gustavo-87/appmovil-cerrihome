import { describe, expect, it, beforeEach } from 'vitest';
import { executeOperation } from '../server/operations.mjs';

// Atomic in-memory harness for unit tests. Real Firestore tests are a separate command.
class Store {
  rows = new Map<string, any>();
  pending = Promise.resolve();
  doc(path: string) { return { path }; }
  runTransaction(action: (tx: any) => Promise<any>) {
    const run = this.pending.then(async () => {
      const changes = new Map<string, any>();
      let writing = false;
      const result = await action({
        get: async (ref: { path: string }) => { if(writing)throw new Error('read after write'); const row=this.rows.get(ref.path);return {exists:row!==undefined,data:()=>structuredClone(row)}; },
        set: (ref: {path: string}, value: any) => {writing=true;changes.set(ref.path,structuredClone(value));},
        delete: (ref: {path: string}) => {writing=true;changes.set(ref.path,undefined);},
      });
      for(const [path,value]of changes)value===undefined?this.rows.delete(path):this.rows.set(path,value);
      return result;
    });
    this.pending=run.then(()=>undefined,()=>undefined);return run;
  }
}
let db: Store;
const clock=()=>new Date('2026-10-13T12:00:00Z');
const draft={p_resident:'Ana',p_unit:'Casa 1',p_area:'Golfito',p_date:'2026-10-14',p_start:'10:00',p_end:'11:00',p_notes:''};
const run=(uid: string, name: string, args: any)=>executeOperation(db,uid,name,args,clock);
beforeEach(()=>{
  db=new Store();db.rows.set('members/admin',{id:'admin',email:'admin@example.com',name:'Admin',role:'admin',active:true});
  db.rows.set('members/guard',{id:'guard',email:'guard@example.com',name:'Guard',role:'guard',active:true});
  db.rows.set('system/admins',{count:1});
});
describe('Operaciones y autorización en el servidor',()=>{
  it('niega operaciones a cuentas no autorizadas o inactivas',async()=>{
    await expect(run('unknown','create_reservation',draft)).rejects.toMatchObject({code:'not_authorized'});
    db.rows.get('members/guard').active=false;
    await expect(run('guard','create_reservation',draft)).rejects.toMatchObject({code:'not_authorized'});
  });
  it('solo acepta Golfito, gimnasio o salón y rechaza BBQ',async()=>{
    await expect(run('guard','create_reservation',{...draft,p_area:'Zona BBQ'})).rejects.toMatchObject({code:'invalid_input'});
    const id=await run('guard','create_reservation',draft);expect(db.rows.get(`reservations/${id}`).area).toBe('Golfito');
  });
  it('serializa reservas en el mismo día y zona y bloquea cruces',async()=>{
    const result=await Promise.allSettled([run('guard','create_reservation',draft),run('admin','create_reservation',{...draft,p_start:'10:30',p_end:'11:30'})]);
    expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(result.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'reservation_conflict'}});
    await run('guard','create_reservation',{...draft,p_start:'11:00',p_end:'12:00'});
  });
  it('cancela liberando la franja sin borrar la reserva',async()=>{
    const id=await run('guard','create_reservation',draft);
    await run('admin','cancel_reservation',{p_id:id});
    expect(db.rows.get(`reservations/${id}`).cancelled).toBe(true);
    await run('guard','create_reservation',draft);
  });
  it('valida fecha, horario futuro, longitud y datos de servidor',async()=>{
    for(const change of [{p_date:'2020-01-01'},{p_date:'2026-10-13',p_start:'06:00',p_end:'06:30'},{p_date:'2099-02-31'},{p_start:'25:00'},{p_resident:' '},{p_notes:'x'.repeat(1001)}]){
      await expect(run('guard','create_reservation',{...draft,...change})).rejects.toMatchObject({code:'invalid_input'});
    }
  });
  it('bloquea placas activas duplicadas y permite reingreso después de salir',async()=>{
    const entry={p_plate:'abc123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',p_note:'Rayón previo'};
    const id=await run('guard','enter_vehicle',entry);
    await expect(run('admin','enter_vehicle',entry)).rejects.toMatchObject({code:'duplicate_vehicle'});
    expect([...db.rows.entries()].filter(([k,v])=>k.startsWith('incidents/')&&v.vehicleId===id)).toHaveLength(1);
    await run('guard','exit_vehicle',{p_id:id});await run('admin','enter_vehicle',entry);
  });
  it('no registra parcialmente un vehículo si la novedad es inválida',async()=>{
    await expect(run('guard','enter_vehicle',{p_plate:'ABC123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',p_note:'x'.repeat(1001)})).rejects.toMatchObject({code:'invalid_input'});
    expect([...db.rows.keys()].some(k=>k.startsWith('vehicles/'))).toBe(false);
  });
  it('exige vehículo existente, valida novedades y permite resolverlas',async()=>{
    await expect(run('guard','create_incident',{p_title:'Prueba',p_description:'Texto',p_category:'General',p_vehicle_id:'missing'})).rejects.toMatchObject({code:'invalid_input'});
    const id=await run('guard','create_incident',{p_title:'Prueba',p_description:'Texto',p_category:'General'});
    await run('admin','resolve_incident',{p_id:id,p_resolved:true});expect(db.rows.get(`incidents/${id}`).resolved).toBe(true);
  });
  it('portería no puede cambiar roles ni crear miembros',async()=>{
    for(const action of ['authorize_member','create_member'])await expect(run('guard',action,{p_id:'guard',p_email:'guard@example.com',p_name:'Guard',p_role:'admin',p_active:true})).rejects.toMatchObject({code:'not_authorized'});
  });
  it('protege al último administrador y mantiene el contador transaccional',async()=>{
    const p={p_id:'admin',p_email:'admin@example.com',p_name:'Admin',p_role:'admin',p_active:false};
    await expect(run('admin','authorize_member',p)).rejects.toMatchObject({code:'last_admin'});
    await run('admin','create_member',{p_id:'second',p_email:'second@example.com',p_name:'Second',p_role:'admin',p_active:true});
    await run('admin','authorize_member',p);expect(db.rows.get('system/admins').count).toBe(1);
    await expect(run('admin','create_reservation',draft)).rejects.toMatchObject({code:'not_authorized'});
  });
  it('no acepta cambiar un correo existente ni rutas de documentos arbitrarias',async()=>{
    await expect(run('admin','authorize_member',{p_id:'guard',p_email:'other@example.com',p_name:'Guard',p_role:'guard',p_active:true})).rejects.toMatchObject({code:'invalid_input'});
    await expect(run('guard','cancel_reservation',{p_id:'../../members/admin'})).rejects.toMatchObject({code:'invalid_input'});
  });
  it('audita operaciones con el actor del token, no del formulario',async()=>{
    const id=await run('guard','create_reservation',{...draft,ownerId:'admin'});
    expect(db.rows.get(`reservations/${id}`).ownerId).toBe('guard');
    expect([...db.rows.entries()].find(([k,v])=>k.startsWith('audit_log/')&&v.recordId===id)?.[1].actorId).toBe('guard');
  });
});

describe('Reintentos de registros sin conexión',()=>{
 it('una respuesta perdida no duplica el vehículo ni la auditoría',async()=>{
  const id='00000000-0000-4000-8000-000000000010';
  const p={p_plate:'ABC123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',p_note:'Rayón',_requestId:id,_occurredAt:'2026-10-13T11:30:00Z'};
  const first=await run('guard','enter_vehicle',p);const count=db.rows.size;
  expect(await run('guard','enter_vehicle',p)).toBe(first);expect(db.rows.size).toBe(count);
  expect(Date.parse(db.rows.get(`vehicles/${id}`).entered)).toBe(Date.parse(p._occurredAt));
  expect(db.rows.get(`incidents/${id}-note`).vehicleId).toBe(id);
 });
 it('conserva la hora local de una salida y rechaza reutilizar una petición con otros datos',async()=>{
  const id='00000000-0000-4000-8000-000000000011';
  await run('guard','enter_vehicle',{p_plate:'ABC123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',_requestId:id,_occurredAt:'2026-10-13T11:00:00Z'});
  await run('guard','exit_vehicle',{p_id:id,_requestId:'00000000-0000-4000-8000-000000000012',_occurredAt:'2026-10-13T11:30:00Z'});
  expect(db.rows.get(`vehicles/${id}`).exited).toBe('2026-10-13T11:30:00.000Z');
  await expect(run('guard','enter_vehicle',{p_plate:'OTHER01',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',_requestId:id})).rejects.toMatchObject({code:'invalid_input'});
 });
 it('una reserva sincronizada sigue siendo idempotente y nunca permite un cruce',async()=>{
  const p={...draft,_requestId:'00000000-0000-4000-8000-000000000013',_occurredAt:'2026-10-13T11:00:00Z'};
  expect(await run('guard','create_reservation',p)).toBe(p._requestId);
  expect(await run('guard','create_reservation',p)).toBe(p._requestId);
  await expect(run('admin','create_reservation',{...draft,_requestId:'00000000-0000-4000-8000-000000000014'})).rejects.toMatchObject({code:'reservation_conflict'});
 });
});

it('un identificador de otro usuario no puede sobrescribir un registro existente',async()=>{
 const id='00000000-0000-4000-8000-000000000020';
 await run('guard','enter_vehicle',{p_plate:'ABC123',p_driver:'Ana',p_unit:'Casa 1',p_reason:'Visita',_requestId:id});
 await expect(run('admin','enter_vehicle',{p_plate:'OTHER01',p_driver:'Otro',p_unit:'Casa 2',p_reason:'Visita',_requestId:id})).rejects.toMatchObject({code:'invalid_input'});
 expect(db.rows.get(`vehicles/${id}`).plate).toBe('ABC123');expect(db.rows.has('active_plates/OTHER01')).toBe(false);
});
