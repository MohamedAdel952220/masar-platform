import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = (name: string) => resolve(__dirname, '../../packages', name, 'src');

export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: false },
  preview: { port: 5178 },
  resolve: {
    // Workspace packages are consumed as SOURCE so there is no per-package
    // build step; Vite transpiles them with the app.
    alias: {
      '@masar/design-system': pkg('design-system'),
      '@masar/api-client': pkg('api-client'),
      '@masar/auth': pkg('auth'),
      '@masar/i18n': pkg('i18n'),
    },
  },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
});
