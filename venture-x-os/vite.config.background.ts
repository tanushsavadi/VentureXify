import { defineConfig } from 'vite';
import { resolve } from 'path';

// Config for background service worker - outputs IIFE format
// NOTE: Using autopilot.ts as entry (the main background worker)
// The index.ts is an alternate version for future migration
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/lib': resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background/autopilot.ts'),
      name: 'VentureXBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    sourcemap: false,
  },
});
