import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    globals: true,
    // Resolve preact/compat for libraries that import react
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/compat',
      // Capacitor mocks for tests — always returns isNativePlatform() = false
      '@capacitor/core': new URL('./test/__mocks__/@capacitor/core.js', import.meta.url).pathname,
      '@capacitor/splash-screen': new URL('./test/__mocks__/@capacitor/splash-screen.js', import.meta.url).pathname,
      '@capacitor/status-bar': new URL('./test/__mocks__/@capacitor/status-bar.js', import.meta.url).pathname,
      '@capacitor-firebase/messaging': new URL('./test/__mocks__/@capacitor-firebase/messaging.js', import.meta.url).pathname,
    },
  },
})
