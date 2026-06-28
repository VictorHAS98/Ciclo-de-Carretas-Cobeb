import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // android: ./ (caminhos relativos para Capacitor)
  // servidor próprio: VITE_BASE_URL=/ npm run build
  // GitHub Pages: VITE_BASE_URL=/Ciclo-de-Carretas-Cobeb/ (default)
  base: process.env.VITE_BUILD_TARGET === 'android'
    ? './'
    : (process.env.VITE_BASE_URL ?? '/Ciclo-de-Carretas-Cobeb/'),
})
