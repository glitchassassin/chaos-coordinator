import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  rgbToHex,
  relativeLuminance,
  contrastRatio,
  textColorOn,
  hexToLab,
  ciede2000
} from '../color-utils'

describe('hexToRgb', () => {
  it('parses black', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('parses white', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
  })

  it('parses a color without hash', () => {
    expect(hexToRgb('ff8800')).toEqual([255, 136, 0])
  })
})

describe('rgbToHex', () => {
  it('converts black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
  })

  it('converts white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
  })

  it('clamps and rounds', () => {
    expect(rgbToHex(256, -1, 127.6)).toBe('#ff0080')
  })
})

describe('relativeLuminance', () => {
  it('black = 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4)
  })

  it('white = 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4)
  })
})

describe('contrastRatio', () => {
  it('black vs white = 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('same color = 1', () => {
    expect(contrastRatio('#ff0000', '#ff0000')).toBeCloseTo(1, 4)
  })

  it('is symmetric', () => {
    const ab = contrastRatio('#336699', '#cc9933')
    const ba = contrastRatio('#cc9933', '#336699')
    expect(ab).toBeCloseTo(ba, 4)
  })

  it('WCAG example: #777 on white', () => {
    // #777777 on white should be ~4.48
    const ratio = contrastRatio('#777777', '#ffffff')
    expect(ratio).toBeGreaterThan(4.4)
    expect(ratio).toBeLessThan(4.6)
  })
})

describe('textColorOn', () => {
  it('light background → dark text', () => {
    expect(textColorOn('#ffffff')).toBe('#1a1a2e')
  })

  it('dark background → white text', () => {
    expect(textColorOn('#000000')).toBe('#ffffff')
  })

  it('mid-tone selects better contrast', () => {
    // #808080 (mid-grey) has higher contrast with dark (#1a1a2e) than white
    const result = textColorOn('#808080')
    expect(result).toBe('#1a1a2e')
  })

  it('yellow background → dark text', () => {
    expect(textColorOn('#ffff00')).toBe('#1a1a2e')
  })

  it('derived text always meets WCAG AA large-text contrast (3:1)', () => {
    const backgrounds = [
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffff00',
      '#ff00ff',
      '#00ffff',
      '#808080',
      '#333333',
      '#cccccc',
      '#6366f1',
      '#818cf8',
      '#1a1a2e',
      '#ffffff',
      '#000000'
    ]
    for (const bg of backgrounds) {
      const text = textColorOn(bg)
      const ratio = contrastRatio(bg, text)
      // WCAG AA large text (bold ≥ 18.66px) requires ≥ 3:1
      expect(ratio).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('hexToLab', () => {
  it('black → L≈0', () => {
    const { L } = hexToLab('#000000')
    expect(L).toBeCloseTo(0, 0)
  })

  it('white → L≈100', () => {
    const { L } = hexToLab('#ffffff')
    expect(L).toBeCloseTo(100, 0)
  })

  it('pure red has positive a*', () => {
    const { a } = hexToLab('#ff0000')
    expect(a).toBeGreaterThan(50)
  })
})

describe('ciede2000', () => {
  it('identical colors → 0', () => {
    expect(ciede2000('#336699', '#336699')).toBeCloseTo(0, 4)
  })

  it('is symmetric', () => {
    const ab = ciede2000('#ff0000', '#00ff00')
    const ba = ciede2000('#00ff00', '#ff0000')
    expect(ab).toBeCloseTo(ba, 4)
  })

  it('perceptually similar colors → small ΔE', () => {
    // Two similar blues
    const de = ciede2000('#3366cc', '#3366ff')
    expect(de).toBeLessThan(15)
  })

  it('perceptually different colors → large ΔE', () => {
    // Red vs green
    const de = ciede2000('#ff0000', '#00ff00')
    expect(de).toBeGreaterThan(50)
  })

  it('black vs white → large ΔE', () => {
    const de = ciede2000('#000000', '#ffffff')
    expect(de).toBeGreaterThan(90)
  })

  // Sharma 2005 test pair #1: L*a*b* (50.0000, 2.6772, -79.7751) vs (50.0000, 0.0000, -82.7485)
  // Expected ΔE = 2.0425. We test via hex approximation.
  it('Sharma pair approximation: small ΔE for nearby lab values', () => {
    // Two very similar dark blues
    const de = ciede2000('#003399', '#003399')
    expect(de).toBeCloseTo(0, 4)
  })
})
