import { useEffect, useState } from 'react';
import { backendError, getQueue, removeQueued, retryQueued, syncPending, watchQueue } from './backend';
import type { QueuedOperation } from './offline';
const labels:Record<string,string>={create_reservation:'Reserva',cancel_reservation:'Cancelación',enter_vehicle:'Ingreso de vehículo',exit_vehicle:'Salida de vehículo',create_incident:'Novedad',resolve_incident:'Resolución de novedad'};
export default function SyncPanel({uid}:{uid:string}){
 const [queue,setQueue]=useState<QueuedOperation[]>([]),[online,setOnline]=useState(navigator.onLine),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 useEffect(()=>watchQueue(uid,setQueue),[uid]);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 const pending=queue.filter(e=>e.status==='pending'),failed=queue.filter(e=>e.status==='failed');
 const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');setResult('');try{await action();const rows=await getQueue(uid);const pending=rows.filter(e=>e.status==='pending'),failed=rows.filter(e=>e.status==='failed');setQueue(rows);setResult(pending.length ? `${pending.length} registros siguen pendientes. ${pending.find(e=>e.error) ? backendError({code:pending.find(e=>e.error)?.error}) : 'No se pudo confirmar el envío. Comprueba que el servidor del Mac sea accesible desde este teléfono.'}` : failed.length ? `${failed.length} registros requieren revisión; consulta el detalle debajo.` : 'No quedan registros pendientes de envío.');}catch(e){setError(backendError(e));}finally{setBusy(false);}};
 return <section className="sync-panel" aria-label="Sincronización"><div className="connection-toolbar"><span role="status">{!online?'Sin conexión · ':''}{pending.length?`${pending.length} registros guardados en este dispositivo, pendientes de sincronizar`:'Sin registros pendientes'}{failed.length?` · ${failed.length} requieren revisión`:''}</span><button className="button secondary small" disabled={!online||busy} onClick={()=>void run(()=>syncPending(uid))}>{busy?'Sincronizando…':'Sincronizar ahora'}</button></div>
 {pending.find(e=>e.error)&&<p>{backendError({code:pending.find(e=>e.error)?.error})}</p>}
 {pending.some(e=>e.name==='create_reservation')&&<p>Las reservas pendientes no están confirmadas: se comprobarán los horarios cuando vuelva la conexión.</p>}
 {failed.map(entry=><article className="sync-failure" key={entry.id}><strong>{labels[entry.name]} · {String(entry.args.p_plate??entry.args.p_title??entry.args.p_resident??'Registro local')}</strong>{entry.name==='create_reservation'&&<p>{String(entry.args.p_area)} · {String(entry.args.p_date)} · {String(entry.args.p_start)}–{String(entry.args.p_end)}</p>}<p>{backendError({code:entry.error})}</p><small>Registrado: {new Date(entry.occurredAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</small><div><button className="text-button" disabled={!online||busy} onClick={()=>void run(()=>retryQueued(entry))}>Reintentar</button><button className="text-button" disabled={busy} onClick={()=>{if(window.confirm('¿Descartar este cambio local que no se pudo sincronizar?'))void run(()=>removeQueued(uid,entry.id));}}>Descartar cambio local</button></div></article>)}
 {result&&<p role="status">{result}</p>}
 {error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
