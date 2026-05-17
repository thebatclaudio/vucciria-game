/// <reference types="vite/client" />

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
