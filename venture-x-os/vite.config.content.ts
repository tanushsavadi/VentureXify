import { defineConfig } from 'vite';
import { resolve } from 'path';

// Config for content script - outputs IIFE format
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
      entry: resolve(__dirname, 'src/content/autopilot.ts'),
      name: 'VentureXContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    sourcemap: false,
  },
});
