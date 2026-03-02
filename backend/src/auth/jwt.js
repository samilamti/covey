/**
 * JWT utilities using jose (HS256).
 *
 * Signs and verifies tokens with the JWT_SECRET env var.
 * Tokens expire after 24 hours.
 */

import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod'
)

const ISSUER = 'tillsammans'
const EXPIRY = '24h'

/**
 * Sign a JWT with the given payload.
 * @param {object} payload - Claims to include (sub, name, userId, provider)
 * @returns {Promise<string>} Signed JWT string
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRY)
    .sign(secret)
}

/**
 * Verify and decode a JWT.
 * @param {string} token - JWT string
 * @returns {Promise<object>} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
  })
  return payload
}
