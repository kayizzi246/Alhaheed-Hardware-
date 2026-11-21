import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds the desk app into the plugin, as two files with fixed names.
 *
 * Fixed names because WordPress enqueues them by path and the plugin
 * ships prebuilt — a shop installing the zip should never need Node.
 * Cache busting is the plugin version on the enqueue, which changes
 * when the bundle does.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../al-hadeed-hardware/assets/app',
    emptyOutDir: true,
    // One bundle. The whole app is four screens; splitting it would
    // trade a 40KB download for a second round trip on a slow line.
    cssCodeSplit: false,
    rollupOptions: {
      // No index.html: the page is WordPress's, so the entry is the
      // script itself.
      input: fileURLToPath(new URL('./src/main.jsx', import.meta.url)),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
        manualChunks: undefined,
      },
    },
    target: 'es2020',
    sourcemap: false,
  },
});
