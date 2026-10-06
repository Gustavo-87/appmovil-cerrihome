import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

export function useAndroidBackButton(onBack: () => boolean) {
  const handler = useRef(onBack);
  useEffect(() => { handler.current = onBack; }, [onBack]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = NativeApp.addListener('backButton', () => {
      if (!handler.current()) void NativeApp.minimizeApp().catch(console.error);
    });
    return () => { void listener.then(handle => handle.remove()).catch(console.error); };
  }, []);
}

export async function exportCsv(content: string, filename: string): Promise<'downloaded' | 'shared' | 'cancelled'> {
  if (Capacitor.getPlatform() === 'android') {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const file = await Filesystem.writeFile({
      path: `reports/${filename}`, data: content, directory: Directory.Cache,
      encoding: Encoding.UTF8, recursive: true,
    });
    try {
      await Share.share({ title: 'Reservas · Cerritos Home', files: [file.uri], dialogTitle: 'Guardar o compartir reporte' });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.message === 'Share canceled') return 'cancelled';
      throw error;
    }
  }

  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
