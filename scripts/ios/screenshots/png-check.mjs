/**
 * Pixel checks for App Store screenshots, used by capture.mjs.
 *
 * checkShot(path) throws unless the PNG is exactly APP_IPHONE_67 size and its
 * status bar carries dark ink. Light status-bar text on Covey's light chrome is
 * invisible (fixed in e9df90c by Style.Light on iOS), and nothing else in the
 * pipeline would notice it coming back.
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export const WANT = { w: 1290, h: 2796 } // APP_IPHONE_67, what an iPhone 16 Plus renders natively


/** Decode an 8-bit RGB/RGBA PNG into { width, height, px(x, y) → [r, g, b] }. */
export function decodePng(path) {
  const buf = readFileSync(path)
  let off = 8
  let width, height, colorType, depth
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      depth = data[8]; colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    off += 12 + len
  }
  if (depth !== 8 || ![2, 6].includes(colorType)) throw new Error(`${path}: unsupported PNG (depth ${depth}, type ${colorType})`)
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = v & 0xff
    }
  }
  return { width, height, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]] } }
}

export function checkShot(path) {
  const img = decodePng(path)
  if (img.width !== WANT.w || img.height !== WANT.h) {
    throw new Error(`${path} is ${img.width}x${img.height}, need ${WANT.w}x${WANT.h}`)
  }
  // The status bar must carry DARK ink over the light chrome (e9df90c). The clock
  // sits top-left: count near-black pixels there.
  let ink = 0
  for (let y = 40; y < 150; y += 2) for (let x = 80; x < 400; x += 2) {
    const [r, g, b] = img.px(x, y)
    if (r + g + b < 200) ink++
  }
  if (ink < 150) throw new Error(`${path}: no dark status-bar ink (${ink} px) — light text on light chrome?`)
  // Mint-green demo theme guard, measured on pixels as well as the DOM.
  let mint = 0
  for (let y = 200; y < img.height; y += 20) for (let x = 0; x < img.width; x += 20) {
    const [r, g, b] = img.px(x, y)
    if (g > 180 && g - r > 40 && g - b > 15 && r < 190) mint++
  }
  return { width: img.width, height: img.height, ink, mint }
}
