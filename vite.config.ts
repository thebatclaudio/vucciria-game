import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// When deploying to https://<USER>.github.io/<REPO>/, set BASE_PATH=/<REPO>/
// Locally, leave unset.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  // Build-time constant exposed to the app for the version footer + logging.
  // Prefer the short Git SHA injected by the GitHub Actions deploy workflow;
  // fall back to the npm package version, then a literal 'dev' for local
  // `pnpm dev` / `pnpm build` runs without a SHA in the environment.
  define: {
    __APP_VERSION__: JSON.stringify(
      (process.env.GITHUB_SHA && process.env.GITHUB_SHA.slice(0, 7)) ||
        process.env.npm_package_version ||
        'dev',
    ),
  },
  // Bump build target so top-level await (used in src/net/room.ts to bind the
  // chosen Trystero strategy at module load) survives esbuild transpilation.
  // ES2022 is supported by Chrome 94+, Safari 15+, Firefox 93+ — all browsers
  // that also support the WebRTC features the app relies on.
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves from <PwaUpdateToast /> so we can show
      // an opt-in toast when a new version is waiting. Without this flag the
      // plugin would auto-inject a silent <script src="/registerSW.js">.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'VucciriaGame',
        short_name: 'Vucciria',
        description: 'Multiplayer drinking board game — P2P, no backend.',
        theme_color: '#f59e0b',
        background_color: '#fef3c7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'manifest-icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'manifest-icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'manifest-icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Bundle locally-prefetched Noto Lottie JSON + SVGs into the precache.
        // `json` covers `public/noto/lottie/*.json`; `svg` already covers the
        // SVG variants. The `.wasm` glob covers the dotLottie WASM runtime.
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,webmanifest,json,wasm}',
        ],
        // New SW takes control of already-open pages as soon as it activates.
        // Combined with the explicit `updateSW(true)` triggered from the
        // <PwaUpdateToast /> "Refresh" button, this gives us a clean reload
        // path without forcing users out of an in-progress session.
        clientsClaim: true,
        // We deliberately keep `skipWaiting` off: the new SW sits in "waiting"
        // until the user accepts the update via the toast. Tapping "Refresh"
        // posts the SKIP_WAITING message and triggers `controllerchange`.
        skipWaiting: false,
        // Wipe Workbox precaches from previous builds so phones don't keep
        // gigabytes of stale Lottie JSON around after a few deploys.
        cleanupOutdatedCaches: true,
        // Per-asset budget bumped because some Noto Lottie JSON payloads are
        // ~200 KB and the default Workbox limit (2 MiB total) is comfortable
        // but the per-file warning trips at default ~2 MiB. Stay safe.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Long-tail avatar assets fetched on demand from Google's CDN.
            // StaleWhileRevalidate keeps mobile UX snappy: serve the cached
            // copy immediately, refresh in the background.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/s\/e\/notoemoji\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'noto-emoji-cdn',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
