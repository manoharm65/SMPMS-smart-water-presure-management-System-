/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080d14',
        panel: '#0b1320',
        border: 'rgba(255,255,255,0.08)',
        text: {
          DEFAULT: 'rgba(255,255,255,0.86)',
          muted: 'rgba(255,255,255,0.62)',
          faint: 'rgba(255,255,255,0.42)',
        },
        accent: {
          DEFAULT: '#00c896',
        },
        warning: '#f5a623',
        critical: '#f04d4d',
        info: '#4a9ff5',
        pressure: {
          normal: '#00c896',
          low: '#4a9ff5',
          warning: '#f5a623',
          critical: '#f04d4d',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

