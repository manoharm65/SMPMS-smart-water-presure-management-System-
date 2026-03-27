import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Match most-specific libraries first, then fall back to a generic vendor bucket.
          if (id.includes('react-router')) return 'router'

          if (
            id.includes('leaflet') ||
            id.includes('react-leaflet') ||
            id.includes('@react-leaflet')
          ) {
            return 'leaflet'
          }

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts'

          if (id.includes('@tanstack/')) return 'tanstack'

          // Only match React core packages (avoid catching packages that merely contain
          // the substring "react" like "react-router" or "@react-leaflet").
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(
              id,
            ) ||
            id.includes('react/jsx-runtime')
          ) {
            return 'react'
          }

          // Default vendor bucket.
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
