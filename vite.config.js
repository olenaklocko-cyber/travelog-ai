import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages публікує застосунок у /travelog/ — відносні шляхи до ресурсів
  base: "./",
  test: {
    // e2e/ — це Playwright, його ганяє `npm run test:e2e`
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    setupFiles: ["server/test-setup.ts"],
  },
})
