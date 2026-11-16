import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Khi build, nối `Sitemap:` vào robots.txt. Sitemap do back-end sinh (`/public/sitemap.xml`), nên chỉ thêm khi
 * `VITE_API_BASE_URL` là địa chỉ tuyệt đối (giao thức sitemap bắt buộc URL đầy đủ).
 */
function robotsSitemap(apiBaseUrl: string | undefined): Plugin {
  let outDir = 'dist';
  return {
    name: 'robots-sitemap',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const robots = join(outDir, 'robots.txt');
      if (!apiBaseUrl || !/^https?:\/\//.test(apiBaseUrl) || !existsSync(robots)) return;
      appendFileSync(robots, `\nSitemap: ${apiBaseUrl.replace(/\/+$/, '')}/public/sitemap.xml\n`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), robotsSitemap(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL)],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    watch: { ignored: ['**/tmp/**', '**/temp/**', '**/test-results/**', '**/playwright-report/**'] },
  },
  // Discover lazy scene dependencies before first interaction; avoid a dev reload.
  optimizeDeps: { include: ['@react-three/fiber', 'three', 'three/examples/jsm/loaders/DRACOLoader.js'] },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tour: fileURLToPath(new URL('./tour.html', import.meta.url)),
      },
    },
  },
}));
