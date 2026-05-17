import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        beer: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        display: ['"Fredoka"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bubble-rise': 'bubble-rise linear infinite',
        'card-flip': 'card-flip 0.6s ease-out',
      },
      keyframes: {
        'bubble-rise': {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '90%': { opacity: '0.8' },
          '100%': { transform: 'translateY(-110vh) scale(1.2)', opacity: '0' },
        },
        'card-flip': {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
