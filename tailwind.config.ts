import type { Config } from 'tailwindcss'

// Palette: "Brown Stout"
// ---------------------
// Warm-on-warm scheme designed to sit on the yellow canvas (#FBC02D → #F9A825)
// the rest of the app uses. Replaces the harsh pure-black look with espresso /
// coffee tones that still hit ≥ 10:1 contrast on the yellow canvas while
// reading as inviting rather than as warning tape.
//
// Canonical token groups (single source of truth):
//   canvas.*    — page background tones (warm yellow)
//   ink.*       — text + dark fills (espresso family)
//   surface.*   — neutral surfaces (just white today, future-proofed)
//   accent.*    — primary button surface (coffee brown) and hover
//   danger/success/warn (.DEFAULT + .soft) — semantic states with paired
//                background-tint shades
const colors = {
  // Page canvas (warm yellow, matches the old vucciria-game-pwa)
  canvas: {
    DEFAULT: '#FBC02D',
    deep: '#F9A825',
  },
  // Text — warm espresso family instead of pure black
  ink: {
    DEFAULT: '#3E2723',
    soft: '#5D4037',
    faint: '#8D6E63',
  },
  surface: {
    DEFAULT: '#FFFFFF',
  },
  // Primary accent — deep coffee brown for buttons
  accent: {
    DEFAULT: '#5D2E14',
    hover: '#3E1A07',
  },
  // Semantic colors — muted so they sit on the yellow without screaming
  danger: {
    DEFAULT: '#B71C1C',
    soft: '#FBE9E7',
  },
  success: {
    DEFAULT: '#2E7D32',
    soft: '#E8F5E9',
  },
  warn: {
    DEFAULT: '#E65100',
    soft: '#FFF3E0',
  },
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: ['"Fredoka"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        button: '0.05em',
      },
      // System-wide radius scale — one purpose per token. Keeps every
      // component reaching for the same value instead of mixing
      // rounded-xl/2xl/3xl/full ad hoc.
      //
      //   btn       all CTA buttons (filled / outlined / destructive)
      //   chip      status pills, language toggle, copy button, small ctas
      //   card      playing-card surface, lobby code box, dialog rows
      //   surface   inputs, list rows, host-action chips
      //   tile      emoji-picker cells, tight square tiles
      borderRadius: {
        btn: '9999px',
        chip: '9999px',
        card: '16px',
        surface: '12px',
        tile: '8px',
      },
      // Two-step elevation scale — keeps cards and dialogs visually
      // related instead of inventing a different shadow each place.
      boxShadow: {
        'elev-1': '0 1px 2px rgba(62, 39, 35, 0.08), 0 2px 8px rgba(62, 39, 35, 0.06)',
        'elev-2': '0 4px 16px rgba(62, 39, 35, 0.18), 0 12px 32px rgba(62, 39, 35, 0.12)',
      },
      // iOS safe-area helpers (consumed via `pb-safe`, `mb-safe`, etc.).
      // The `env(safe-area-inset-bottom)` is exposed as `--safe-b` in
      // index.css so we can take the max of "design padding" and "device
      // safe area" without losing either.
      spacing: {
        safe: 'var(--safe-b)',
      },
      // Only `bubble-rise` is consumed (by BeerBubbles). The old
      // `card-flip` keyframe was never wired (Card uses framer-motion's
      // own rotateY) and was removed in the Phase 5 cleanup.
      animation: {
        'bubble-rise': 'bubble-rise linear infinite',
      },
      keyframes: {
        'bubble-rise': {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '90%': { opacity: '0.8' },
          '100%': { transform: 'translateY(-110vh) scale(1.2)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
