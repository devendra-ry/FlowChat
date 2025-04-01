import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',  // Change output directory to match Netlify's expected path
    rollupOptions: {
      external: ['@rollup/rollup-linux-x64-gnu']
    }
  }
})
