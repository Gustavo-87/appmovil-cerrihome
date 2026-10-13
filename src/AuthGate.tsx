import { useEffect, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, backendError, demoMode, getQueue, watchProfile } from './backend';
import type { Profile } from './permissions';
import App from './App';
import { useTheme } from './useTheme';

const demoProfile: Profile = { id: 'demo', name: 'Equipo Cerritos', email: 'demo@example.com', unit: '', role: 'admin', active: true };
export default function AuthGate() {
  const { theme, toggleTheme } = useTheme();
  const [session, setSession] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, next => { setSession(next); setProfile(null); setLoading(Boolean(next)); }, () => { setLoading(false); setError('No se pudo recuperar tu sesión.'); });
  }, []);
  useEffect(() => {
    if (!session) return;
    return watchProfile(session.uid, next => {
      setProfile(next?.active ? next : null); setLoading(false);
      setError(next?.active ? '' : 'Tu cuenta no tiene acceso activo. Contacta a administración.');
    }, e => { setProfile(null); setLoading(false); setError(backendError(e)); });
  }, [session]);
  async function signOut() {
    if(session){const pending=await getQueue(session.uid);if(pending.some(entry=>entry.status!=='confirmed')&&!window.confirm('Hay registros pendientes en este teléfono. Se conservarán y solo podrán sincronizarse al volver a ingresar con esta cuenta. ¿Cerrar sesión?'))return;}
    setProfile(null); setPassword('');
    try { if (auth) await firebaseSignOut(auth); setError(''); setNotice(''); }
    catch { setError('No se pudo cerrar la sesión. Intenta nuevamente.'); }
  }
  async function login(e: FormEvent) {
    e.preventDefault(); if (!auth || lock.current) return;
    if(!navigator.onLine){setError('El primer ingreso y la recuperación de contraseña requieren Internet. Conserva tu sesión para trabajar sin conexión.');return;}
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password); setPassword(''); }
    catch { setError('No se pudo ingresar. Revisa el correo y la contraseña, o solicita un enlace para establecerla.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function resetPassword() {
    if (!auth || lock.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Ingresa primero tu correo electrónico.'); return; }
    if(!navigator.onLine){setError('El primer ingreso y la recuperación de contraseña requieren Internet. Conserva tu sesión para trabajar sin conexión.');return;}
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); setNotice('Si el correo tiene una cuenta, recibirás un enlace para establecer tu contraseña.'); }
    catch { setError('No se pudo solicitar el enlace. Espera un momento e intenta nuevamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (demoMode) return <App profile={demoProfile} onSignOut={() => location.reload()} demo />;
  if (session && profile) return <App key={`${profile.id}:${profile.role}`} profile={profile} onSignOut={signOut} demo={false}/>;
  return <main className="auth-screen"><section className="panel auth-card">
    <img src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} alt="Cerritos Home" width="64" height="64"/><button className="button secondary small auth-theme" onClick={toggleTheme}>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button>
    <span className="eyebrow">CERRITOS HOME</span><h1>{loading ? 'Verificando acceso…' : 'Bienvenido a casa'}</h1>
    {!auth ? <><p>La aplicación aún no está habilitada. Contacta a administración.</p><p className="subtle">Firebase está pendiente de configuración.</p></> : loading ? <p role="status">Estamos verificando tu sesión.</p> : session ? <><p role="alert">{error || 'Tu cuenta no tiene acceso activo.'}</p><button className="button secondary" onClick={() => void signOut()}>Cerrar sesión</button></> : <>
      <p>Ingresa con el correo y la contraseña de tu cuenta autorizada.</p>
      <form onSubmit={login}><label>Correo electrónico<input type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)}/></label>
        {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button className="button primary" disabled={busy}>{busy ? 'Espera…' : 'Ingresar'}</button>
      </form><button className="text-button" disabled={busy} onClick={() => void resetPassword()}>Establecer o recuperar contraseña</button>
    </>}
  </section></main>;
}
