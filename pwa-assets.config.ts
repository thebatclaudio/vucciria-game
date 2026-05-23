import {
  defineConfig,
  minimalPreset as preset,
} from '@vite-pwa/assets-generator/config'

/**
 * @vite-pwa/assets-generator configuration.
 *
 * Goal: edge-to-edge amber icons with no white border or transparent
 * halo. The default `minimal` preset inscribes the source into a
 * transparent (or white, for maskable/apple-touch) canvas with padding,
 * which produced a visible white ring on Android home screens. We
 * override both so the amber background of `source.svg` fills every
 * pixel of every rendered PNG, and any rasteriser padding falls back
 * to the same amber color.
 *
 * Regenerate with:
 *   npx @vite-pwa/assets-generator
 */
export default defineConfig({
  preset: {
    ...preset,
    transparent: {
      ...preset.transparent,
      // No transparent inset for the standard PWA icons; the source
      // SVG already covers the full canvas with the amber backdrop.
      padding: 0,
      resizeOptions: {
        ...preset.transparent.resizeOptions,
        background: '#f59e0b',
      },
    },
    maskable: {
      ...preset.maskable,
      // Source artwork is already sized inside the maskable safe
      // zone, so we don't need the generator to add additional
      // padding. Any residual padding must be amber, not white.
      padding: 0,
      resizeOptions: {
        ...preset.maskable.resizeOptions,
        background: '#f59e0b',
      },
    },
    apple: {
      ...preset.apple,
      padding: 0,
      resizeOptions: {
        ...preset.apple.resizeOptions,
        background: '#f59e0b',
      },
    },
  },
  images: ['public/manifest-icons/source.svg'],
})
