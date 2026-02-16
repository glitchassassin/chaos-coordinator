/**
 * Pure color utility functions — no Node/Electron dependencies.
 * Importable by both main and renderer processes.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => {
        const clamped = Math.max(0, Math.min(255, Math.round(c)))
        return clamped.toString(16).padStart(2, '0')
      })
      .join('')
  )
}

function linearize(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance (0–1) */
export function relativeLuminance(hex: string): number {
  const [rr, gg, bb] = hexToRgb(hex)
  const r = linearize(rr)
  const g = linearize(gg)
  const b = linearize(bb)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio (1–21) */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Returns white or dark text color for best readability on the given background */
export function textColorOn(backgroundHex: string): '#ffffff' | '#1a1a2e' {
  const whiteContrast = contrastRatio(backgroundHex, '#ffffff')
  const darkContrast = contrastRatio(backgroundHex, '#1a1a2e')
  return darkContrast > whiteContrast ? '#1a1a2e' : '#ffffff'
}

// --- CIELAB / CIEDE2000 ---

/** sRGB hex → CIELAB { L, a, b } via D65 XYZ */
export function hexToLab(hex: string): { L: number; a: number; b: number } {
  const [rr, gg, bb] = hexToRgb(hex)
  const r = linearize(rr)
  const g = linearize(gg)
  const b = linearize(bb)

  // sRGB → XYZ (D65)
  let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b // /1.0
  let z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883

  const epsilon = 216 / 24389
  const kappa = 24389 / 27

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  }
}

/** CIEDE2000 perceptual color difference */
export function ciede2000(hex1: string, hex2: string): number {
  const lab1 = hexToLab(hex1)
  const lab2 = hexToLab(hex2)

  const L1 = lab1.L,
    a1 = lab1.a,
    b1 = lab1.b
  const L2 = lab2.L,
    a2 = lab2.a,
    b2 = lab2.b

  const avgL = (L1 + L2) / 2
  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const avgC = (C1 + C2) / 2

  const avgC7 = Math.pow(avgC, 7)
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))))

  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)

  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)
  const avgCp = (C1p + C2p) / 2

  let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI
  if (h1p < 0) h1p += 360
  let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI
  if (h2p < 0) h2p += 360

  let avgHp: number
  if (Math.abs(h1p - h2p) > 180) {
    avgHp = (h1p + h2p + 360) / 2
  } else {
    avgHp = (h1p + h2p) / 2
  }

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180)

  let dhp: number
  if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360
  } else {
    dhp = h2p - h1p + 360
  }

  const dLp = L2 - L1
  const dCp = C2p - C1p
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * (Math.PI / 180))

  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2))
  const SC = 1 + 0.045 * avgCp
  const SH = 1 + 0.015 * avgCp * T

  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2))
  const avgCp7 = Math.pow(avgCp, 7)
  const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)))
  const RT = -Math.sin((2 * dTheta * Math.PI) / 180) * RC

  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
      Math.pow(dCp / SC, 2) +
      Math.pow(dHp / SH, 2) +
      RT * (dCp / SC) * (dHp / SH)
  )
}
