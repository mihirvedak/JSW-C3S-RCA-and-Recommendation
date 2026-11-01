import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'

const DEFAULT_CONNECTOR = 'https://connector.iosense.io'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.IOSENSE_CONNECTOR_URL || DEFAULT_CONNECTOR

  // Hostnames allowed to reach the dev server. Vite rejects anything else by default
  // (DNS-rebinding protection), which blocks access through a proxied hostname. A
  // leading dot allows a domain and all its subdomains.
  const allowedHosts = (env.VITE_ALLOWED_HOSTS ?? '.iocompute.ai')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  // The connector sends no CORS headers for a browser origin, so /api is proxied
  // straight through to it. The Authorization header the app sets is forwarded
  // unchanged.
  // Each proxied answer is logged (status, bytes, seconds) so a failing device-data request can be
  // read from the server log without a browser: `[proxy] GET /api/... -> 200 0 B 31.2 s` is a
  // response the connector or a gateway cut off.
  const proxy: Record<string, ProxyOptions> = {
    '/api': {
      target,
      changeOrigin: true,
      secure: true,
      // No proxy-side timeouts: a week of minute data can take the connector tens of seconds.
      timeout: 0,
      proxyTimeout: 0,
      configure(p) {
        const started = new WeakMap<object, number>()
        p.on('proxyReq', (_proxyReq, req) => {
          started.set(req, Date.now())
        })
        p.on('proxyRes', (proxyRes, req) => {
          let bytes = 0
          proxyRes.on('data', (c: Buffer) => {
            bytes += c.length
          })
          proxyRes.on('end', () => {
            const secs = ((Date.now() - (started.get(req) ?? Date.now())) / 1000).toFixed(1)
            console.log(`[proxy] ${req.method} ${req.url} -> ${proxyRes.statusCode} ${bytes} B ${secs} s`)
          })
        })
        p.on('error', (err, req) => {
          console.log(`[proxy] ${req.method} ${req.url} -> ERROR ${err.message}`)
        })
      },
    },
  }

  return {
    plugins: [react()],
    server: { allowedHosts, proxy },
    // `vite preview` does NOT inherit `server.proxy` — it needs its own. Without this
    // the preview server treats /api as a static path and answers any non-GET with
    // 405 Method Not Allowed, which looks like an API fault but never leaves the box.
    preview: { allowedHosts, proxy },
  }
})
