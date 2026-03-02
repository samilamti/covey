/**
 * Test utilities for backend tests.
 *
 * Provides mock Express req/res objects, assertion helpers, and
 * environment setup/teardown for feature flag tests.
 */

/**
 * Create a mock Express request object.
 * @param {object} overrides - Properties to merge into the mock
 * @returns {object} Mock request
 */
export function mockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    user: null,
    get(name) {
      return this.headers[name.toLowerCase()]
    },
    ...overrides,
  }
}

/**
 * Create a mock Express response object with spies.
 * @returns {object} Mock response with .statusCode, .body, .headers
 */
export function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    _headers: {},
    status(code) {
      res.statusCode = code
      return res
    },
    json(data) {
      res.body = data
      return res
    },
    send(data) {
      res.body = data
      return res
    },
    set(name, value) {
      res._headers[name.toLowerCase()] = value
      return res
    },
    end() {
      return res
    },
  }
  return res
}

/**
 * Set FEATURE_* env vars for testing. Returns a cleanup function
 * that restores the original values.
 * @param {Record<string, string>} vars - e.g. { FEATURE_BANKID_AUTH: 'true' }
 * @returns {() => void} cleanup function
 */
export function setEnvVars(vars) {
  const originals = {}
  for (const [key, value] of Object.entries(vars)) {
    originals[key] = process.env[key]
    process.env[key] = value
  }
  return () => {
    for (const [key] of Object.entries(vars)) {
      if (originals[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originals[key]
      }
    }
  }
}
