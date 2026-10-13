export type Role = 'admin' | 'guard';
export type Profile = { id: string; email: string; name: string; unit: string; role: Role; active: boolean };
export const roleLabels: Record<Role, string> = { admin: 'Administrador', guard: 'Portería' };
export function canOperate(profile: Profile) {
  return profile.active && (profile.role === 'admin' || profile.role === 'guard');
}
export function canAccessPage(profile: Profile, page: string) {
  if (!profile.active) return false;
  if (page === 'Administración') return profile.role === 'admin';
  return canOperate(profile) && ['Inicio', 'Reservas', 'Vehículos', 'Novedades'].includes(page);
}
