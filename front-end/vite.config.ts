import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  // Discover lazy scene dependencies before first interaction; avoid a dev reload.
  optimizeDeps: { include: ['@react-three/fiber', 'three', 'three/examples/jsm/controls/OrbitControls.js'] },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tour: fileURLToPath(new URL('./tour.html', import.meta.url)),
      },
    },
  },
});
