/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from balenthiran.co.uk/birthday — see helm/values.yaml.
  base: '/birthday/',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    proxy: {
      // The client calls /birthday/api/... because that is what works in the
      // cluster. Locally the backend has no PathBase, so strip the prefix here.
      '/birthday/api': {
        target: 'http://localhost:5257',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/birthday/, ''),
      },
      '/openapi': {
        target: 'http://localhost:5257',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    // e2e/ is Playwright's; Vitest would try to run those specs and fail on
    // Playwright's test API.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
