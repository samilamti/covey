/**
 * Mock @capacitor/core for vitest tests.
 * All platform checks return false (web mode).
 */
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
}
