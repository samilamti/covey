// Capture store screenshots from the web UI via headless system Chrome.
// The web UI is what the native apps render, so these are valid store shots.
//
// Usage (no Docker/Postgres needed — uses the mock backend):
//   1. node scripts/screenshots/mock-backend.mjs &          (mock API on :3000)
//   2. cd frontend && npm run dev &                          (Vite on :5173, proxies /api)
//   3. cd scripts/screenshots && npm i playwright-core && \
//      node capture.mjs [outDir] [width] [height] [scale]
//
// Defaults produce Google Play phone shots: 360x800 @3x = 1080x2400 PNG.
// For iOS 6.7" (1290x2796): node capture.mjs shots-ios 430 932 3
//
// Captures: landing, open-requests list (default view when open requests
// exist), create form, progress dashboard, profile. Logs in with a plain
// test NIN — NOT the 999999999999 demo NIN, which flips the mint
// easter-egg theme; store shots should show the standard brand theme.
import { chromium } from 'playwright-core'
import fs from 'fs'

const OUT = process.argv[2] || 'shots'
const W = parseInt(process.argv[3] || '360', 10)
const H = parseInt(process.argv[4] || '800', 10)
const SCALE = parseInt(process.argv[5] || '3', 10)
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
  locale: 'sv-SE',
  geolocation: { latitude: 59.3293, longitude: 18.0686 },
  permissions: ['geolocation'],
})
const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()) })

const shot = async (name) => {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('captured', name)
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await shot('01-landing')

await page.fill('input', '199501012384')
await page.locator('button', { hasText: /BankID|Logga in/i }).first().click()
await page.waitForSelector('nav', { timeout: 15000 })
// With open requests in the mock, the list is the initial view
await page.waitForTimeout(1000)
await shot('02-oppna-forfragningar')

// Header "+ Ny förfrågan" toggles to the create form
await page.locator('button', { hasText: /Ny förfrågan/i }).first().click()
await shot('03-skapa-forfragan')

// Bottom-nav tabs
const navButtons = page.locator('nav button, nav a')
const navCount = await navButtons.count()
for (let i = 0; i < navCount; i++) {
  const label = (await navButtons.nth(i).textContent())?.trim().toLowerCase() || ''
  if (/framsteg/.test(label)) {
    await navButtons.nth(i).click()
    await shot('04-framsteg')
  } else if (/profil/.test(label)) {
    await navButtons.nth(i).click()
    await shot('05-profil')
  }
}

await browser.close()
console.log('done —', OUT)
