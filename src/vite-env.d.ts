/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected at build time by `define` in vite.config.ts. Holds the short Git
// SHA on CI builds, the npm package version when run via pnpm scripts, or
// the literal string 'dev' for raw local builds.
declare const __APP_VERSION__: string

// Trystero ships a single ambient module declaration at the package root
// (`declare module 'trystero'`) but its `package.json#exports` map exposes
// per-strategy subpaths whose runtime API is identical. Re-declare those
// subpaths here so we can dynamic-import the chosen strategy without
// resorting to `any` casts.
declare module 'trystero/nostr' {
  export * from 'trystero'
}
declare module 'trystero/mqtt' {
  export * from 'trystero'
}
declare module 'trystero/torrent' {
  export * from 'trystero'
}

interface ImportMetaEnv {
  readonly VITE_TRYSTERO_STRATEGY?: 'nostr' | 'mqtt' | 'torrent'
  readonly VITE_TRYSTERO_RELAYS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
