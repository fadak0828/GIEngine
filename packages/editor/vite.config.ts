import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// base must match the GitHub repository name for GitHub Pages deployment
const base = process.env.NODE_ENV === 'production'
  ? '/GIEngine/'
  : '/';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gi-engine/exporter': path.resolve(__dirname, '../exporter/src/browser.ts'),
      '@gi-engine/ai': path.resolve(__dirname, '../ai/src/index.ts'),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        landing: path.resolve(__dirname, 'landing.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
