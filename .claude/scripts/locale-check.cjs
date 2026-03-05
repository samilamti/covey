#!/usr/bin/env node
/**
 * Validates i18n key parity across all 12 locale files.
 * Canonical source: sv.json (Swedish).
 */
const fs = require('fs')
const path = require('path')

const dir = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'locales')
const locales = ['sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en']

function flatKeys(obj, prefix) {
  prefix = prefix || ''
  const results = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      results.push(...flatKeys(v, key))
    } else {
      results.push(key)
    }
  }
  return results
}

const sv = JSON.parse(fs.readFileSync(path.join(dir, 'sv.json'), 'utf8'))
const svKeys = new Set(flatKeys(sv))
let ok = true

for (const lang of locales) {
  if (lang === 'sv') continue
  const file = path.join(dir, lang + '.json')
  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(lang + ': INVALID JSON — ' + e.message)
    ok = false
    continue
  }
  const keys = new Set(flatKeys(data))
  const missing = [...svKeys].filter(function (k) { return !keys.has(k) })
  const extra = [...keys].filter(function (k) { return !svKeys.has(k) })
  if (missing.length || extra.length) {
    ok = false
    if (missing.length) console.error(lang + ' missing: ' + missing.join(', '))
    if (extra.length) console.error(lang + ' extra: ' + extra.join(', '))
  }
}

if (ok) {
  console.log('All 12 locale files in parity (' + svKeys.size + ' keys each)')
} else {
  process.exit(1)
}
