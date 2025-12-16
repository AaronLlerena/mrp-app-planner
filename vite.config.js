import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRUCIAL: Necesario para que Vercel sepa dónde iniciar
  base: '/', 
  build: {
    outDir: 'dist', 
  },
})