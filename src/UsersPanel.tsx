import { useEffect, useRef, useState, type FormEvent } from 'react';
import { auth, backendError, createAccount, listProfiles, rpc } from './backend';
import { sendPasswordResetEmail } from 'firebase/auth';
import { roleLabels, type Profile, type Role } from './permissions';

export default function UsersPanel({ profile, demo }: { profile: Profile; demo: boolean }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const refresh = async () => {
    if (demo || !auth) return;
    const data = await listProfiles();
    if (mounted.current) setUsers(data);
  };
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => { if (mounted.current) setError(backendError(e)); });
    return () => { mounted.current = false; };
  }, [demo]);

  async function perform(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); if (mounted.current) { setNotice('Acceso actualizado correctamente.'); window.dispatchEvent(new Event('cerritos-access-changed')); } }
    catch (e) { if (mounted.current) setError(backendError(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function save(e: FormEvent<HTMLFormElement>, current?: Profile) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const values = { email: String(fields.get('email')).trim().toLowerCase(), name: String(fields.get('name')).trim(), unit: String(fields.get('unit')).trim(), role: String(fields.get('role')) as Role, active: current ? fields.get('active') === 'on' : true };
    await perform(async () => {
      if (demo) throw new Error('demo');
      if (current) await rpc('authorize_member', { p_id: current.id, p_email: current.email, p_name: values.name, p_unit: values.unit, p_role: values.role, p_active: values.active });
      else {
        await createAccount(values);
        form.reset();
      }
    });
  }

  return <section className="panel users-panel"><h2>Gestión de usuarios</h2><p>Autoriza al equipo de portería y administración. Las nuevas cuentas establecen su contraseña desde el enlace de recuperación de Firebase.</p>
    {demo ? <p className="admin-notice">La gestión de usuarios requiere conexión al servidor.</p> : <>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <h3>Autorizar una persona</h3><form onSubmit={e => void save(e)}><fieldset disabled={busy}><div className="form-grid">
        <label>Correo electrónico<input name="email" type="email" required maxLength={254}/></label><label>Nombre completo<input name="name" required maxLength={90}/></label>
        <input name="unit" type="hidden" value=""/><label>Rol<select name="role" defaultValue="guard">{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
      </div><button className="button primary" type="submit">Autorizar acceso</button></fieldset></form>
      <h3>Personas autorizadas</h3><div className="users-list">{users.map(user => <form className="user-row" key={`${user.id}:${user.role}:${user.active}:${user.name}:${user.unit}`} onSubmit={e => void save(e, user)}><fieldset disabled={busy}>
        <strong>{user.email}{user.id === profile.id ? ' (tu cuenta)' : ''}</strong><input type="hidden" name="email" value={user.email}/>
        <div className="form-grid"><label>Nombre<input name="name" defaultValue={user.name} required maxLength={90}/></label><input name="unit" type="hidden" value=""/><label>Rol<select name="role" defaultValue={user.role}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label><label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={user.active}/>Acceso activo</label></div>
        <button className="button secondary small" type="submit">Guardar acceso</button><button className="text-button" type="button" onClick={()=>void perform(async()=>{await sendPasswordResetEmail(auth!,user.email);})}>Enviar enlace de contraseña</button>
      </fieldset></form>)}</div>
    </>}
  </section>;
}
