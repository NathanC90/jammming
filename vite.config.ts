/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /jammming/.
  base: process.env.GITHUB_PAGES ? '/jammming/' : '/',
  plugins: [react()],
  server: {
    // Spotify only accepts loopback IP redirect URIs, not "localhost".
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    env: { VITE_SPOTIFY_CLIENT_ID: 'test-client-id' },
  },
})
