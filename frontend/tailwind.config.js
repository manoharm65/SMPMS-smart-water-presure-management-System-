/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        paper: '#F5F0E8',
        rule: '#1A1A1A',
        dim: '#6B6B6B',
        muted: '#B8B2A8',
        signal: '#E8001D',
        pass: '#007A3D',
        warn: '#CC5500',
        low: '#004DB3',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        condensed: ['Barlow Condensed', 'sans-serif'],
        sans: ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
