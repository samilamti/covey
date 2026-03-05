import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Injects a build timestamp into sw.js so each deploy produces a unique SW file.
// The browser detects the byte change and triggers the update flow.
function swVersionPlugin() {
  return {
    name: 'sw-version',
    closeBundle() {
      const swPath = resolve('dist/sw.js')
      let sw = readFileSync(swPath, 'utf-8')
      const version = Date.now().toString(36)
      sw = sw.replace('__SW_VERSION__', version)
      writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  plugins: [preact(), swVersionPlugin()],
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
