/**
 * Screenshot mode — lets scripts/ios/08-screenshots.sh drive the app with no taps.
 *
 * ONLY compiled into builds made with VITE_SCREENSHOT_MODE=1, which nothing but
 * 08-screenshots.sh sets. main.jsx calls startScreenshotMode() behind a
 * compile-time check on that variable, so a normal build tree-shakes this whole
 * module away. scripts/ios/lib/assert-no-screenshot-mode.sh fails the release
 * pipeline if SCREENSHOT_MARKER ever appears in a shipped bundle.
 *
 * Protocol: the capture script runs a small "director" HTTP server on localhost.
 * The app polls GET <director>/scene, which describes one scene:
 *   { seq, token, reload?, position?, steps: [...] }
 * When seq changes the app puts the requested session token in place (reloading
 * if it had to change it), runs the steps, and POSTs the outcome to
 * <director>/ready. The director then takes the simulator screenshot.
 *
 * It also answers navigator.geolocation from the scene's position, so the shots
 * do not depend on simulator location permissions or prompts.
 */

export const SCREENSHOT_MARKER = 'covey-screenshot-mode'

const POLL_MS = 500
const STEP_TIMEOUT_MS = 15000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function find(sel, text) {
  const nodes = Array.from(document.querySelectorAll(sel))
  return nodes.find((n) => text === undefined || (n.textContent || '').includes(text)) || null
}

async function waitFor(sel, text) {
  const t0 = Date.now()
  while (Date.now() - t0 < STEP_TIMEOUT_MS) {
    const el = find(sel, text)
    if (el) return el
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${sel}${text === undefined ? '' : ` containing "${text}"`}`)
}

function fill(el, value) {
  // Preact listens for input events; a plain .value write is not seen.
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

async function runSteps(steps) {
  for (const s of steps) {
    if (s.waitFor) await waitFor(s.waitFor, s.text)
    else if (s.click) (await waitFor(s.click, s.text)).click()
    else if (s.fill) fill(await waitFor(s.fill), s.value)
    else if (s.sleep) await sleep(s.sleep)
    else throw new Error(`unknown step ${JSON.stringify(s)}`)
  }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
}

function installGeolocation(getPosition) {
  const current = () => {
    const p = getPosition()
    if (!p) return null
    return {
      coords: { latitude: p.lat, longitude: p.lng, accuracy: 10, altitude: null,
        altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now(),
    }
  }
  const geo = {
    getCurrentPosition(ok, fail) {
      const pos = current()
      if (pos) setTimeout(() => ok(pos), 0)
      else if (fail) setTimeout(() => fail({ code: 2, message: 'no scene position' }), 0)
    },
    watchPosition(ok) {
      const tick = () => { const pos = current(); if (pos) ok(pos) }
      tick()
      return setInterval(tick, 2000)
    },
    clearWatch(id) { clearInterval(id) },
  }
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true })
}

export function startScreenshotMode(director) {
  console.info(`[${SCREENSHOT_MARKER}] active, director ${director}`)
  let position = null
  let applied = null
  installGeolocation(() => position)

  const report = (body) =>
    fetch(`${director}/ready`, { method: 'POST', body: JSON.stringify(body) }).catch(() => {})

  const tick = async () => {
    let scene = null
    try {
      scene = await (await fetch(`${director}/scene`, { cache: 'no-store' })).json()
    } catch {
      return
    }
    if (scene.position) position = scene.position
    if (scene.seq === applied) return

    const wantToken = scene.token || null
    const haveToken = localStorage.getItem('token')
    const reloadedFor = sessionStorage.getItem('screenshotSeq')
    const needReload =
      wantToken !== haveToken ||
      localStorage.getItem('demoMode') !== null ||
      (scene.reload && reloadedFor !== String(scene.seq))
    if (needReload) {
      // Never photograph the mint demo theme.
      localStorage.removeItem('demoMode')
      if (wantToken) localStorage.setItem('token', wantToken)
      else localStorage.removeItem('token')
      sessionStorage.setItem('screenshotSeq', String(scene.seq))
      location.reload()
      return new Promise(() => {}) // stop polling until the reload lands
    }

    applied = scene.seq
    try {
      await runSteps(scene.steps || [])
      await report({
        seq: scene.seq,
        ok: true,
        mint: document.body.classList.contains('mint-theme'),
        text: document.body.innerText.slice(0, 4000),
      })
    } catch (err) {
      await report({ seq: scene.seq, ok: false, error: err.message })
    }
  }

  const loop = async () => {
    await tick()
    setTimeout(loop, POLL_MS)
  }
  loop()
}
