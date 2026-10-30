import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;

/**
 * Generates dist/sw.js from src/pwa/sw-template.js with the full precache list
 * (every emitted bundle file + public assets) and a versioned cache name.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'tpa-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = new Set<string>(['./', './index.html', './manifest.webmanifest']);
      for (const name of Object.keys(bundle)) {
        if (name.endsWith('.map') || name === 'sw.js') continue;
        files.add('./' + name);
      }
      for (const icon of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png']) {
        files.add('./' + icon);
      }
      const template = readFileSync(resolve(__dirname, 'src/pwa/sw-template.js'), 'utf8');
      const source = template
        .replace('__BUILD_ID__', BUILD_ID)
        .replace('__PRECACHE_LIST__', JSON.stringify([...files], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base so the game works at https://<user>.github.io/<repo>/
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          peerjs: ['peerjs'],
        },
      },
    },
  },
  plugins: [serviceWorkerPlugin()],
});
