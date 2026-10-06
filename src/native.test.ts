import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  writeFile: vi.fn(), share: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
vi.mock('@capacitor/app', () => ({ App: {} }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: native.writeFile }, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }));

import { exportCsv } from './native';

describe('Exportación de reservas en Android', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.writeFile.mockResolvedValue({ uri: 'file:///cache/reports/reservas.csv' });
    native.share.mockResolvedValue({});
  });
  it('comparte el CSV UTF-8 desde la caché privada, sin permisos de almacenamiento', async () => {
    const csv = '\uFEFFResidente,Zona\r\nMaría,Salón social';
    expect(await exportCsv(csv, 'reservas.csv')).toBe('shared');
    expect(native.writeFile).toHaveBeenCalledWith({
      path: 'reports/reservas.csv', data: csv, directory: 'CACHE', encoding: 'utf8', recursive: true,
    });
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/reports/reservas.csv'] }));
  });
  it('distingue la cancelación del usuario de un fallo de exportación', async () => {
    native.share.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await exportCsv('datos', 'reservas.csv')).toBe('cancelled');
    native.share.mockRejectedValueOnce(new Error('No activity found'));
    await expect(exportCsv('datos', 'reservas.csv')).rejects.toThrow('No activity found');
  });
  it('no abre el selector de compartir si el archivo no pudo guardarse', async () => {
    native.writeFile.mockRejectedValueOnce(new Error('Not enough space'));
    await expect(exportCsv('datos', 'reservas.csv')).rejects.toThrow('Not enough space');
    expect(native.share).not.toHaveBeenCalled();
  });
});
