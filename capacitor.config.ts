import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cerritoshome.app',
  appName: 'Cerritos Home',
  webDir: 'dist',
  android: {
    backgroundColor: '#10231f',
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
