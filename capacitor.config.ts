import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'br.com.cobeb.ciclocarretas',
  appName: 'COBEB Ciclo',
  webDir:  'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BackgroundGeolocation: {
      backgroundMessage: 'COBEB está rastreando sua localização',
      backgroundTitle:   'COBEB Ciclo — Rastreamento ativo',
      requestPermissions: true,
      stale:             false,
      distanceFilter:    20,
    },
  },
}

export default config
