/**
 * Runtime platform configuration.
 *
 * Capacitor apps run from capacitor://localhost (iOS) or http://localhost
 * (Android), so relative API URLs won't reach the production server.
 * This module provides the base URL to prepend — empty string on web
 * (preserving existing behavior), production URL on native.
 */
import { Capacitor } from '@capacitor/core'

/**
 * Base URL for all API calls.
 * Empty string on web (relative URLs), full URL on native.
 */
export const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.DEV ? '' : nativeApiBase())
  : ''

/**
 * Production API on native. A screenshot build (VITE_SCREENSHOT_MODE=1, made only
 * by scripts/ios/08-screenshots.sh) talks to a local backend instead, so capture
 * never touches production data.
 */
function nativeApiBase() {
  if (import.meta.env.VITE_SCREENSHOT_MODE === '1') return import.meta.env.VITE_SCREENSHOT_API_BASE
  return 'https://covey.se'
}
