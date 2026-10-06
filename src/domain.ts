export type Area = 'Salón social' | 'Gimnasio' | 'Zona BBQ';
export type Reservation = { id: string; resident: string; unit: string; area: Area; date: string; start: string; end: string; notes: string; cancelled: boolean };
export type Vehicle = { id: string; plate: string; driver: string; unit: string; reason: string; entered: string; exited: string | null };
export type Incident = { id: string; title: string; description: string; category: string; created: string; resolved: boolean; vehicleId?: string };
export type Data = { reservations: Reservation[]; vehicles: Vehicle[]; incidents: Incident[] };
export const areas: Area[] = ['Salón social', 'Gimnasio', 'Zona BBQ'];
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function shiftDate(date: string, days: number) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function reservationError(r: Omit<Reservation, 'id' | 'cancelled'>, existing: Reservation[]) {
  if (!r.resident.trim() || !r.unit.trim() || !areas.includes(r.area)) return 'Completa el residente, la vivienda y la zona.';
  const parsed = new Date(r.date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== r.date || r.date < today()) return 'Selecciona una fecha válida de hoy en adelante.';
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(r.start) || !validTime.test(r.end) || r.start >= r.end) return 'La hora de salida debe ser posterior a la hora de entrada y ambas horas deben ser válidas.';
  if (existing.some(x => !x.cancelled && x.area === r.area && x.date === r.date && r.start < x.end && r.end > x.start)) return 'Esta zona ya está reservada en ese horario. Elige otro horario.';
  return '';
}
export function vehicleError(plate: string, driver: string, unit: string, vehicles: Vehicle[]) {
  if (!/^[A-Z0-9-]{4,10}$/.test(plate)) return 'Ingresa una placa válida de 4 a 10 caracteres.';
  if (!driver.trim() || !unit.trim()) return 'Completa el conductor y la vivienda de destino.';
  if (vehicles.some(v => v.plate === plate && !v.exited)) return 'Este vehículo ya tiene un ingreso activo.';
  return '';
}
export function seedData(): Data {
  const date = today();
  const at = (time: string) => new Date(`${date}T${time}:00-05:00`).toISOString();
  const rs: [string,string,Area,string,string][] = [['Valentina Gómez','Casa 24','Gimnasio','07:00','08:00'],['Andrés Martínez','Casa 18','Salón social','10:00','12:00'],['Camila Restrepo','Casa 36','Zona BBQ','12:00','15:00'],['Santiago López','Casa 12','Gimnasio','16:00','17:00'],['Mariana Pérez','Casa 08','Salón social','18:00','21:00']];
  return {
    reservations: rs.map((r,i) => ({id:`demo-r${i}`,resident:r[0],unit:r[1],area:r[2],date,start:r[3],end:r[4],notes:i===2?'Reunión familiar. Entregar la zona limpia.':'',cancelled:false})).concat([{id:'demo-next',resident:'Daniela Ruiz',unit:'Casa 42',area:'Zona BBQ',date:shiftDate(date,1),start:'12:00',end:'14:00',notes:'',cancelled:false}]),
    vehicles: [{id:'demo-v1',plate:'KPL482',driver:'Carlos Ramírez',unit:'Casa 18',reason:'Visita',entered:at('09:15'),exited:null},{id:'demo-v2',plate:'JHT619',driver:'Laura Torres',unit:'Casa 36',reason:'Servicio técnico',entered:at('08:40'),exited:null},{id:'demo-v3',plate:'WQR205',driver:'Miguel Castro',unit:'Casa 24',reason:'Domicilio',entered:at('07:30'),exited:at('07:45')}],
    incidents: [{id:'demo-i1',title:'Luminaria de acceso intermitente',description:'La luminaria junto al acceso peatonal necesita revisión de mantenimiento.',category:'Mantenimiento',created:at('08:30'),resolved:false},{id:'demo-i2',title:'Rayón reportado al ingreso',description:'El conductor reporta un rayón previo en la puerta trasera derecha.',category:'Vehículo',vehicleId:'demo-v1',created:at('09:15'),resolved:false}]
  };
}
export const STORAGE_KEY = 'cerritos-home-v1';
export function loadData(): {data: Data; error: string} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {data:seedData(),error:''};
    const d = JSON.parse(raw);
    const fields = (x: Record<string,unknown>, names: string[]) => x && names.every(k => typeof x[k] === 'string');
    if (!d || !Array.isArray(d.reservations) || !Array.isArray(d.vehicles) || !Array.isArray(d.incidents)
      || !d.reservations.every((r: Reservation) => fields(r,['id','resident','unit','area','date','start','end','notes']) && areas.includes(r.area) && typeof r.cancelled === 'boolean')
      || !d.vehicles.every((v: Vehicle) => fields(v,['id','plate','driver','unit','reason','entered']) && (v.exited === null || typeof v.exited === 'string'))
      || !d.incidents.every((i: Incident) => fields(i,['id','title','description','category','created']) && typeof i.resolved === 'boolean')) throw new Error('Invalid data');
    return {data:d,error:''};
  } catch { return {data:seedData(),error:'No se pudieron leer los datos locales. Se muestra una demostración sin sobrescribir tus datos. Revisa el almacenamiento del navegador.'}; }
}
