import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Emits dist/sw.js from sw/sw.js with this build's files to precache (the
// app shell, the Google Fonts stylesheet, the logo) and a version derived
// from them, so every new build replaces the old offline copy.
function serviceWorker() {
  return {
    name: 'forge-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html');
      const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
      const fonts = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      const precache = ['/', '/logo.png', ...files.map((f) => `/${f}`), ...fonts];
      const template = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8');
      const version = createHash('sha256').update(template).update(html).update(precache.join('\n')).digest('hex').slice(0, 12);
      const source = template
        .replace('self.__PRECACHE__', JSON.stringify(precache))
        .replace('__VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
