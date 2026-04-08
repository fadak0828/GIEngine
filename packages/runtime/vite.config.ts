import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GIEngine',
      formats: ['es', 'iife'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'iife.js'}`,
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    cssCodeSplit: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
