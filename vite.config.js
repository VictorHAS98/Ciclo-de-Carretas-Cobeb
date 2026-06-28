import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Web (GitHub Pages): /Ciclo-de-Carretas-Cobeb/
  // Android (Capacitor): ./ (caminhos relativos para file:// e http://localhost)
  base: process.env.VITE_BUILD_TARGET === 'android' ? './' : '/Ciclo-de-Carretas-Cobeb/',
})
