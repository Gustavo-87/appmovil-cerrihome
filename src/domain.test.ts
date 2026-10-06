import { describe, expect, it } from 'vitest';
import { reservationError, vehicleError, today, shiftDate, type Reservation } from './domain';
const draft = {resident:'Ana',unit:'Casa 1',area:'Zona BBQ' as const,date:today(),start:'10:00',end:'12:00',notes:''};
const booked: Reservation = {...draft,id:'1',cancelled:false};
describe('Reservas', () => {
  it('rechaza solapamientos parciales y totales', () => {
    for (const [start,end] of [['09:00','11:00'],['11:00','13:00'],['10:30','11:00'],['09:00','13:00']]) expect(reservationError({...draft,start,end},[booked])).toContain('ya está reservada');
  });
  it('permite horarios adyacentes, otras zonas y reservas canceladas', () => {
    expect(reservationError({...draft,start:'12:00',end:'13:00'},[booked])).toBe('');
    expect(reservationError({...draft,area:'Gimnasio'},[booked])).toBe('');
    expect(reservationError(draft,[{...booked,cancelled:true}])).toBe('');
  });
  it('rechaza fechas pasadas y horarios invertidos', () => {
    expect(reservationError({...draft,date:shiftDate(today(),-1)},[])).not.toBe('');
    expect(reservationError({...draft,end:'09:00'},[])).not.toBe('');
  });
  it('rechaza fechas inexistentes y horas fuera de rango', () => {
    expect(reservationError({...draft,date:'2099-02-31'},[])).not.toBe('');
    expect(reservationError({...draft,start:'25:00',end:'26:00'},[])).not.toBe('');
  });
});
describe('Control vehicular', () => {
  const vehicle = {id:'v',plate:'ABC123',driver:'Ana',unit:'Casa 1',reason:'Visita',entered:new Date().toISOString(),exited:null};
  it('evita ingresos duplicados y permite reingreso después de salida', () => {
    expect(vehicleError('ABC123','Ana','Casa 1',[vehicle])).toContain('ingreso activo');
    expect(vehicleError('ABC123','Ana','Casa 1',[{...vehicle,exited:new Date().toISOString()}])).toBe('');
  });
  it('valida placa y destino', () => {
    expect(vehicleError('!','Ana','Casa 1',[])).not.toBe('');
    expect(vehicleError('ABC123','Ana','',[])).not.toBe('');
  });
});
