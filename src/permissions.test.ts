import { describe, expect, it } from 'vitest';
import { canAccessPage, canOperate, type Profile } from './permissions';
const user: Profile = { id: 'one', email: 'test@example.com', name: 'Ana', unit: '', role: 'guard', active: true };
describe('Navegación según permisos', () => {
  it('portería puede gestionar la operación sin administrar usuarios', () => {
    expect(canAccessPage(user, 'Vehículos')).toBe(true);
    expect(canAccessPage(user, 'Administración')).toBe(false);
    expect(canAccessPage(user, 'Reservas')).toBe(true);
    expect(canOperate(user)).toBe(true);
  });
  it('administración tiene acceso a todas las secciones', () => {
    const admin = { ...user, role: 'admin' as const };
    expect(canOperate(admin)).toBe(true);
    expect(canAccessPage(admin, 'Administración')).toBe(true);
  });
  it('una cuenta desactivada no tiene acceso, incluso si es administrador', () => {
    const blocked = { ...user, role: 'admin' as const, active: false };
    expect(canOperate(blocked)).toBe(false);
    for (const page of ['Inicio', 'Reservas', 'Vehículos', 'Novedades', 'Administración']) expect(canAccessPage(blocked, page)).toBe(false);
  });
});
