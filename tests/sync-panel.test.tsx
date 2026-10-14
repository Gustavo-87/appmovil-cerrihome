// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SyncPanel from '../src/SyncPanel';
const state=vi.hoisted(()=>({rows:[] as any[]}));
vi.mock('../src/backend',()=>({watchQueue:(_uid:any,cb:any)=>{cb(state.rows);return()=>{};},getQueue:async()=>state.rows,syncPending:async()=>{},retryQueued:async()=>{},removeQueued:async()=>{},backendError:()=> 'Sin conexión con el servidor.'}));
afterEach(cleanup);
it('explica que siguen pendientes después de un intento sin conexión al servidor',async()=>{state.rows=[{id:'1',uid:'u',name:'enter_vehicle',args:{},status:'pending',error:'network_error'}];render(<SyncPanel uid="u"/>);fireEvent.click(screen.getByText('Sincronizar ahora'));expect(await screen.findByText(/1 registros siguen pendientes/)).toBeTruthy();});
it('informa cuando termina sin pendientes',async()=>{state.rows=[];render(<SyncPanel uid="u"/>);fireEvent.click(screen.getByText('Sincronizar ahora'));expect(await screen.findByText('No quedan registros pendientes de envío.')).toBeTruthy();});
