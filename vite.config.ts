import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// When deploying to https://<USER>.github.io/<REPO>/, set BASE_PATH=/<REPO>/
// Locally, leave unset.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
