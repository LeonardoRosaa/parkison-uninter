import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,js}']
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/ws': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
