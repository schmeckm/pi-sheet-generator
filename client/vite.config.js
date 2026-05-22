import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const apiPort = env.PORT || '7000';
  const apiUrl = env.VITE_API_URL || `http://localhost:${apiPort}/api`;
  const devPort = Number(env.VITE_DEV_PORT || 7002);
  const port = apiPort;
  const proxyTarget = apiUrl.startsWith('http')
    ? apiUrl.replace(/\/api\/?$/, '').replace('://localhost', '://127.0.0.1')
    : `http://127.0.0.1:${port}`;

  /** Vite defaults to HTTP 500 when the API is down — return 503 + JSON instead. */
  function configureApiProxy(proxy) {
    proxy.on('error', (err, _req, res) => {
      console.warn('[vite] API proxy error:', err.message);
      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'API_UNAVAILABLE',
            message:
              'API auf Port ' +
              port +
              ' nicht erreichbar. Bitte npm run dev im Projektroot (Server + Client).',
          })
        );
      }
    });
  }

  return {
    plugins: [vue()],
    envDir: fileURLToPath(new URL('..', import.meta.url)),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: devPort,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
          configure: configureApiProxy,
        },
        '/ws': {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
          configure: configureApiProxy,
        },
      },
    },
  };
});
