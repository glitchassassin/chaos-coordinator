/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Array access in tests after bounds verification */

import { describe, it, expect, vi } from 'vitest'

// Mock electron before importing extractPalette
vi.mock('electron', () => ({
  nativeImage: {
    createFromPath: vi.fn()
  }
}))

vi.mock('node:fs', () => ({
  statSync: vi.fn(() => ({ size: 1024 })) // default: small file
}))

import { kMeansClusters, extractPalette } from '../color-extraction'
import { nativeImage } from 'electron'
import { statSync } from 'node:fs'
import { contrastRatio, textColorOn } from '../../../shared/lib/color-utils'

type RgbPoint = [number, number, number]

describe('kMeansClusters', () => {
  it('returns empty for empty input', () => {
    const result = kMeansClusters([], 5)
    expect(result.centers).toHaveLength(0)
    expect(result.sizes).toHaveLength(0)
  })

  it('handles single color', () => {
    const points: RgbPoint[] = Array.from({ length: 100 }, () => [255, 0, 0])
    const result = kMeansClusters(points, 3)
    const center = result.centers[0]
    expect(center).toBeDefined()
    expect(center![0]).toBeCloseTo(255, 0)
    expect(center![1]).toBeCloseTo(0, 0)
    expect(center![2]).toBeCloseTo(0, 0)
  })

  it('finds two distinct clusters', () => {
    const points: RgbPoint[] = [
      ...Array.from({ length: 50 }, (): RgbPoint => [255, 0, 0]),
      ...Array.from({ length: 50 }, (): RgbPoint => [0, 0, 255])
    ]
    const result = kMeansClusters(points, 2)
    expect(result.centers).toHaveLength(2)

    const hexCenters = result.centers.map(
      ([r, g, b]) =>
        `${String(Math.round(r))},${String(Math.round(g))},${String(Math.round(b))}`
    )
    const hasRed = hexCenters.some((c) => c === '255,0,0')
    const hasBlue = hexCenters.some((c) => c === '0,0,255')
    expect(hasRed).toBe(true)
    expect(hasBlue).toBe(true)
  })

  it('finds five tight clusters', () => {
    const clusterColors: RgbPoint[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [255, 0, 255]
    ]
    const points: RgbPoint[] = []
    for (const color of clusterColors) {
      for (let i = 0; i < 20; i++) {
        points.push([...color])
      }
    }
    const result = kMeansClusters(points, 5)
    expect(result.centers).toHaveLength(5)
    expect(result.sizes).toHaveLength(5)
    for (const size of result.sizes) {
      expect(size).toBe(20)
    }
  })

  it('sorts largest cluster first', () => {
    const points: RgbPoint[] = [
      ...Array.from({ length: 100 }, (): RgbPoint => [255, 0, 0]),
      ...Array.from({ length: 10 }, (): RgbPoint => [0, 0, 255])
    ]
    const result = kMeansClusters(points, 2)
    expect(result.sizes[0]).toBeGreaterThan(result.sizes[1]!)
    const center = result.centers[0]
    expect(center).toBeDefined()
    expect(center![0]).toBeGreaterThan(200)
  })

  it('limits k to number of points', () => {
    const points: RgbPoint[] = [[128, 128, 128]]
    const result = kMeansClusters(points, 5)
    expect(result.centers).toHaveLength(1)
  })
})

describe('extractPalette', () => {
  it('returns hex colors from image bitmap', () => {
    // Create a 2x2 BGRA bitmap: all red pixels
    const bitmap = Buffer.from([
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255
    ])

    const mockImg = {
      isEmpty: () => false,
      resize: () => ({
        toBitmap: () => bitmap
      })
    }

    vi.mocked(nativeImage.createFromPath).mockReturnValue(
      mockImg as unknown as Electron.NativeImage
    )

    const result = extractPalette('/fake/path.png', 3)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe('#ff0000')
  })

  it('returns empty array for empty image', () => {
    const mockImg = {
      isEmpty: () => true
    }

    vi.mocked(nativeImage.createFromPath).mockReturnValue(
      mockImg as unknown as Electron.NativeImage
    )

    const result = extractPalette('/fake/empty.png')
    expect(result).toEqual([])
  })

  it('returns colors that satisfy text contrast constraints', () => {
    // 4 pixels: 2 red, 2 blue (BGRA format)
    const bitmap = Buffer.from([
      0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255
    ])

    const mockImg = {
      isEmpty: () => false,
      resize: () => ({
        toBitmap: () => bitmap
      })
    }

    vi.mocked(nativeImage.createFromPath).mockReturnValue(
      mockImg as unknown as Electron.NativeImage
    )

    const result = extractPalette('/fake/contrast.png', 2)

    for (const hex of result) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
      const text = textColorOn(hex)
      // WCAG AA large text (bold >= 18.66px) requires >= 3:1
      expect(contrastRatio(hex, text)).toBeGreaterThanOrEqual(3)
    }
  })

  it('skips transparent pixels', () => {
    // 2 pixels: first transparent (alpha=0), second blue (BGRA: B=255, G=0, R=0, A=255)
    const bitmap = Buffer.from([255, 0, 0, 0, 255, 0, 0, 255])

    const mockImg = {
      isEmpty: () => false,
      resize: () => ({
        toBitmap: () => bitmap
      })
    }

    vi.mocked(nativeImage.createFromPath).mockReturnValue(
      mockImg as unknown as Electron.NativeImage
    )

    const result = extractPalette('/fake/alpha.png', 1)
    expect(result.length).toBe(1)
    expect(result[0]).toBe('#0000ff')
  })

  it('returns empty array for oversized file', () => {
    vi.mocked(statSync).mockReturnValue({ size: 25 * 1024 * 1024 } as ReturnType<
      typeof statSync
    >)

    const result = extractPalette('/fake/huge.png', 3)
    expect(result).toEqual([])

    // Reset to default small file size for other tests
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>)
  })
})
