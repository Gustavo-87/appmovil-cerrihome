import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocsFromServer, getFirestore, onSnapshot } from 'firebase/firestore';
import type { Data } from './domain';
import type { Profile } from './permissions';

export const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const app = !demoMode && Object.values(config).every(Boolean) ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/$/, '');
export const emptyData: Data = { reservations: [], vehicles: [], incidents: [] };

export function backendError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'reservation_conflict') return 'Esta zona ya está reservada en ese horario. Elige otro horario.';
  if (code === 'duplicate_vehicle') return 'Este vehículo ya tiene un ingreso activo.';
  if (code === 'account_exists') return 'Ese correo ya tiene una cuenta. Revisa las personas autorizadas.';
  if (code === 'not_authorized' || code === 'permission-denied') return 'Tu cuenta no tiene permiso para esta operación.';
  if (code === 'last_admin') return 'Debe permanecer al menos un administrador activo.';
  if (code === 'invalid_input') return 'Revisa los datos, la fecha y el horario.';
  return 'No se pudo completar la operación. Comprueba tu conexión e intenta nuevamente.';
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  if (!auth?.currentUser) throw { code: 'not_authorized' };
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${apiOrigin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw { code: data.error };
  return data as T;
}
export const rpc = <T,>(name: string, args?: Record<string, unknown>) => api<T>(`operations/${encodeURIComponent(name)}`, args ?? {});
export const listProfiles = () => api<Profile[]>('users');
export const createAccount = (values: Omit<Profile, 'id'>) => api<Profile>('users', values);
export async function fetchProfile(): Promise<Profile | null> {
  if (!db || !auth?.currentUser) return null;
  const snapshot = await getDoc(doc(db, 'members', auth.currentUser.uid));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Profile : null;
}
export function watchProfile(id: string, onData: (profile: Profile | null) => void, onError: (e: unknown) => void) {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'members', id), snapshot => onData(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Profile : null), onError);
}
export async function fetchData(): Promise<Data> {
  if (!db) throw new Error('Firebase no configurado');
  const names = ['reservations', 'vehicles', 'incidents'] as const;
  const result = await Promise.all(names.map(name => getDocsFromServer(collection(db, name))));
  return Object.fromEntries(result.map((snapshot, index) => [names[index], snapshot.docs.map(row => ({ ...row.data(), id: row.id }))])) as Data;
}
export function subscribeData(onData: (data: Data) => void, onError: (error: unknown) => void) {
  if (!db) return () => {};
  const data: Data = { reservations: [], vehicles: [], incidents: [] };
  const ready = new Set<string>();
  let closed = false;
  const stops = (['reservations','vehicles','incidents'] as const).map(name => onSnapshot(collection(db, name), snapshot => {
    if (closed) return;
    Object.assign(data, { [name]: snapshot.docs.map(row => ({ ...row.data(), id: row.id })) });
    ready.add(name);
    if (ready.size === 3) onData({ ...data });
  }, error => { if (!closed) onError(error); }));
  return () => { closed = true; stops.forEach(stop => stop()); };
}
