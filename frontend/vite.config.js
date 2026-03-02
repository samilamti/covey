import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    // Target browsers that cover old Android (Chrome 60+, iOS 10+)
    target: 'baseline-widely-available',
    // Keep chunks reasonably sized for slow connections
    chunkSizeWarningLimit: 200,
  },
  server: {
    // In dev, proxy API + socket calls to backend
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
})
