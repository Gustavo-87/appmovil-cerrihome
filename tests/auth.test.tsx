// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AuthGate from '../src/AuthGate';
const state=vi.hoisted(()=>({role:'guard',active:true,loginFails:false,authCallback:null as any,profileCallback:null as any,data:{reservations:[],vehicles:[],incidents:[]},rpc:vi.fn(),reset:vi.fn()}));
vi.mock('firebase/auth',()=>({
 onAuthStateChanged:vi.fn((_auth,callback)=>{state.authCallback=callback;callback(null);return ()=>{};}),
 signInWithEmailAndPassword:vi.fn(async()=>{if(state.loginFails)throw new Error('invalid');state.authCallback({uid:'operator'});}),
 signOut:vi.fn(async()=>state.authCallback(null)),
 sendPasswordResetEmail:state.reset,
}));
vi.mock('../src/backend',()=>({
 auth:{currentUser:{uid:'operator'}},demoMode:false,emptyData:{reservations:[],vehicles:[],incidents:[]},
 backendError:(e:any)=>e.code==='reservation_conflict'?'Esta zona ya está reservada en ese horario.':'Operación rechazada.',
 watchProfile:vi.fn((_id,callback)=>{state.profileCallback=callback;callback({id:'operator',email:'operator@example.com',name:'Operador',unit:'',role:state.role,active:state.active});return ()=>{};}),
 subscribeData:vi.fn(callback=>{callback(state.data);return ()=>{};}),fetchData:vi.fn(async()=>state.data),
 listProfiles:vi.fn(async()=>[]),createAccount:vi.fn(),rpc:state.rpc,watchQueue:vi.fn((_uid,cb)=>{cb([]);return()=>{};}),syncPending:vi.fn(),retryQueued:vi.fn(),removeQueued:vi.fn(),getQueue:vi.fn(async()=>[]),
}));
beforeEach(()=>{
 state.role='guard';state.active=true;state.loginFails=false;state.rpc.mockReset();state.reset.mockReset();
 Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 localStorage.clear();
});
afterEach(cleanup);
async function login(){
 fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'operator@example.com'}});
 fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Secret123!'}});
 fireEvent.click(screen.getByRole('button',{name:'Ingresar',exact:true}));
 await screen.findByRole('heading',{name:'Tu comunidad, en orden.'});
}
describe('Ingreso Firebase y acceso por rol (servicios simulados)',()=>{
 it('muestra el error de contraseña y permite solicitar recuperación',async()=>{
  state.loginFails=true;render(<AuthGate/>);
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'operator@example.com'}});
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'wrong'}});
  fireEvent.click(screen.getByRole('button',{name:'Ingresar',exact:true}));
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo ingresar');
  fireEvent.click(screen.getByRole('button',{name:'Establecer o recuperar contraseña'}));
  expect((await screen.findByRole('status')).textContent).toContain('recibirás un enlace');
  expect(state.reset).toHaveBeenCalledWith(expect.anything(),'operator@example.com');
 });
 it('portería no accede a administración ni persiste operaciones locales',async()=>{
  render(<AuthGate/>);await login();
  expect(within(screen.getByRole('navigation',{name:'Navegación principal'})).queryByRole('button',{name:'Administración'})).toBeNull();
  expect(localStorage.getItem('cerritos-home-v1')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Cerrar sesión',exact:true}));
  await screen.findByLabelText('Contraseña');expect(screen.queryByRole('navigation',{name:'Navegación principal'})).toBeNull();
 });
 it('administración muestra gestión de usuarios con los dos roles',async()=>{
  state.role='admin';render(<AuthGate/>);await login();
  fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación principal'})).getByRole('button',{name:'Administración'}));
  await screen.findByRole('heading',{name:'Gestión de usuarios'});
  expect(screen.getByLabelText('Rol').querySelectorAll('option')).toHaveLength(2);
 });
 it('una desactivación recibida en vivo oculta los datos',async()=>{
  render(<AuthGate/>);await login();
  act(()=>state.profileCallback({id:'operator',role:'guard',active:false}));
  expect((await screen.findByRole('alert')).textContent).toContain('acceso activo');
  expect(screen.queryByRole('navigation',{name:'Navegación principal'})).toBeNull();
 });
 it('una reserva rechazada por el servidor no se anuncia como guardada',async()=>{
  state.rpc.mockRejectedValue({code:'reservation_conflict'});render(<AuthGate/>);await login();
  fireEvent.click(screen.getByRole('button',{name:'Nueva reserva',exact:true}));
  const dialog=screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button',{name:'Golfito',exact:true}));
  fireEvent.change(within(dialog).getByLabelText('Nombre del residente'),{target:{value:'Ana'}});
  fireEvent.change(within(dialog).getByLabelText('Casa o apartamento'),{target:{value:'Casa 1'}});
  fireEvent.change(within(dialog).getByLabelText('Fecha'),{target:{value:'2099-01-01'}});
  fireEvent.submit(dialog.querySelector('form')!);
  expect((await within(dialog).findByRole('alert')).textContent).toContain('ya está reservada');
  expect(screen.queryByText('Reserva creada correctamente')).toBeNull();
 });
});
