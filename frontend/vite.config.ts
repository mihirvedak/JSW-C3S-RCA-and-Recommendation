import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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
  const proxy = {
    '/api': {
      target,
      changeOrigin: true,
      secure: true,
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
