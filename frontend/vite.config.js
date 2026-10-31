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
      try {
        let sw = readFileSync(swPath, 'utf-8')
        if (!sw.includes('__SW_VERSION__')) {
          throw new Error('sw.js is missing __SW_VERSION__ placeholder')
        }
        const version = Date.now().toString(36)
        sw = sw.replace('__SW_VERSION__', version)
        writeFileSync(swPath, sw)
        console.log(`[sw-version] stamped sw.js with version: ${version}`)
      } catch (err) {
        throw new Error(`[sw-version] Failed to stamp sw.js: ${err.message}`)
      }
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
    rollupOptions: {
      output: {
        // Split heavy third-party deps into their own chunks so the main
        // app bundle stays small and these cache separately across deploys.
        // Preact itself is not named here, but it does NOT stay in the entry
        // chunk: Rollup pulls it into `i18n` because react-i18next imports it
        // (the `icons` chunk then imports it from there). That load order has
        // no cycle and renders fine; rebuild and check the chunk imports if
        // you add a rule here, since a cycle between chunks breaks at runtime.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('socket.io')) return 'socket'
          if (id.includes('lucide-preact')) return 'icons'
          if (id.includes('qrcode-generator')) return 'qrcode'
        },
      },
    },
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
