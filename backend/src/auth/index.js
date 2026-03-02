/**
 * Auth module re-exports.
 *
 * Provides backward-compatible imports for api.js and other consumers:
 *   import { authRouter, authenticate } from './auth/index.js'
 */

export { authRouter } from './router.js'
export { authenticate } from './middleware.js'
export { signToken, verifyToken } from './jwt.js'
