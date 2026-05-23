# PWA Icons

All PNG/ICO files in this directory are **generated artifacts** produced
from `source.svg` by [`@vite-pwa/assets-generator`][gen]. Do not edit them
by hand.

## Files

| File                            | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `source.svg`                    | Hand-authored source artwork (the only file you should edit).        |
| `pwa-64x64.png`                 | Small PWA icon (browser UI, favicon fallback).                       |
| `pwa-192x192.png`               | Android home-screen icon (manifest `icons[]`).                       |
| `pwa-512x512.png`               | Splash-screen / high-DPI icon (manifest `icons[]`).                  |
| `maskable-icon-512x512.png`     | Android adaptive icon — kept inside the 40% safe zone of `source.svg`. |
| `apple-touch-icon-180x180.png`  | iOS Safari "Add to Home Screen" tile (referenced by `index.html`).   |
| `favicon.ico`                   | Legacy favicon (unused — root `/favicon.svg` is primary).            |

## Regenerate

After editing `source.svg`, run from the repo root:

```bash
pnpm exec pwa-assets-generator
```

The generator reads `pwa-assets.config.ts` at the repo root, which
extends the `minimal` preset with `padding: 0` and an amber
(`#f59e0b`) background fill on every variant. This is what eliminates
the white border / transparent halo that the stock preset produces.
Outputs land next to `source.svg`. Commit all updated PNGs alongside
the SVG change.

## Editing the source artwork

`source.svg` is a 512×512 viewBox. Keep the focal artwork **inside the
central 60%** (radius ≤ 205 px from center) so the same source works for
both the standard and the `purpose: maskable` Android variant — Android
crops maskable icons to circular / squircle / rounded-rect shapes and
chops off anything outside the safe zone.

The palette uses the app's Tailwind `beer.*` scale, see `tailwind.config.ts`.

## Where these are wired up

- Manifest `icons[]` entries → `vite.config.ts` (`VitePWA({ manifest: { icons: [...] } })`).
- iOS apple-touch-icon → `index.html` `<link rel="apple-touch-icon" ...>`.
- SW precache inclusion → `VitePWA({ includeAssets: [...] })` in `vite.config.ts`.

[gen]: https://vite-pwa-org.netlify.app/assets-generator/
