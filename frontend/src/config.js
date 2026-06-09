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
  ? (import.meta.env.DEV ? '' : 'https://covey.se')
  : ''
