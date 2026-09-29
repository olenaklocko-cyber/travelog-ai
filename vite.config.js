import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages публікує застосунок у /travelog/ — відносні шляхи до ресурсів
  base: "./",
})
