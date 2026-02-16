import { nativeImage } from 'electron'
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Array indices are bounds-checked by loop constraints in k-means */
import { statSync } from 'node:fs'
import { rgbToHex } from '../../shared/lib/color-utils'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MB

type RgbPoint = [number, number, number]

interface ClusterResult {
  centers: RgbPoint[]
  sizes: number[]
}

function distanceSq(a: RgbPoint, b: RgbPoint): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/** K-means++ initialization: pick k seeds with distance-weighted probability */
function initCenters(points: RgbPoint[], k: number): RgbPoint[] {
  const centers: RgbPoint[] = []
  // Pick first center uniformly at random
  const firstIdx = Math.floor(Math.random() * points.length)
  centers.push(points[firstIdx]!)

  const distances = new Float64Array(points.length)

  for (let c = 1; c < k; c++) {
    let totalDist = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      let minDist = Infinity
      for (const center of centers) {
        const d = distanceSq(p, center)
        if (d < minDist) minDist = d
      }
      distances[i] = minDist
      totalDist += minDist
    }

    // Weighted random selection
    let threshold = Math.random() * totalDist
    let chosen = 0
    for (let i = 0; i < points.length; i++) {
      threshold -= distances[i]!
      if (threshold <= 0) {
        chosen = i
        break
      }
    }
    centers.push(points[chosen]!)
  }

  return centers
}

/**
 * K-means clustering in RGB space.
 * Returns centers sorted by cluster size (largest first).
 */
export function kMeansClusters(
  points: RgbPoint[],
  k: number,
  maxIter = 20
): ClusterResult {
  if (points.length === 0) {
    return { centers: [], sizes: [] }
  }

  const effectiveK = Math.min(k, points.length)
  let centers = initCenters(points, effectiveK)

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign points to nearest center
    const sums: RgbPoint[] = Array.from({ length: effectiveK }, () => [0, 0, 0])
    const counts = new Array<number>(effectiveK).fill(0)

    for (const point of points) {
      let bestIdx = 0
      let bestDist = Infinity
      for (let c = 0; c < effectiveK; c++) {
        const d = distanceSq(point, centers[c]!)
        if (d < bestDist) {
          bestDist = d
          bestIdx = c
        }
      }
      sums[bestIdx]![0] += point[0]
      sums[bestIdx]![1] += point[1]
      sums[bestIdx]![2] += point[2]
      counts[bestIdx]!++
    }

    // Compute new centers
    let maxShift = 0
    const newCenters: RgbPoint[] = centers.map((old, i) => {
      const count = counts[i]!
      if (count === 0) return old
      const nc: RgbPoint = [sums[i]![0] / count, sums[i]![1] / count, sums[i]![2] / count]
      const shift = distanceSq(old, nc)
      if (shift > maxShift) maxShift = shift
      return nc
    })

    centers = newCenters
    if (maxShift <= 1.0) break
  }

  // Sort by cluster size descending
  const assignments = points.map((point) => {
    let bestIdx = 0
    let bestDist = Infinity
    for (let c = 0; c < effectiveK; c++) {
      const d = distanceSq(point, centers[c]!)
      if (d < bestDist) {
        bestDist = d
        bestIdx = c
      }
    }
    return bestIdx
  })

  const sizes = new Array<number>(effectiveK).fill(0)
  for (const idx of assignments) {
    sizes[idx]!++
  }

  const indices = Array.from({ length: effectiveK }, (_, i) => i)
  indices.sort((a, b) => sizes[b]! - sizes[a]!)

  return {
    centers: indices.map((i) => centers[i]!),
    sizes: indices.map((i) => sizes[i]!)
  }
}

/**
 * Extract a color palette from an image file using k-means clustering.
 * Uses Electron's nativeImage for decoding — no extra dependencies.
 */
export function extractPalette(imagePath: string, k = 5): string[] {
  try {
    const stat = statSync(imagePath)
    if (stat.size > MAX_IMAGE_BYTES) return []
  } catch {
    return []
  }

  const img = nativeImage.createFromPath(imagePath)
  if (img.isEmpty()) {
    return []
  }

  const resized = img.resize({ width: 64, height: 64 })
  const bitmap = resized.toBitmap()
  const pixels: RgbPoint[] = []

  // Bitmap is BGRA on all platforms (Electron nativeImage.toBitmap())
  for (let i = 0; i < bitmap.length; i += 4) {
    const alpha = bitmap[i + 3]
    if (alpha !== undefined && alpha < 128) continue

    const b = bitmap[i]
    const g = bitmap[i + 1]
    const r = bitmap[i + 2]
    if (r !== undefined && g !== undefined && b !== undefined) {
      pixels.push([r, g, b])
    }
  }

  if (pixels.length === 0) {
    return []
  }

  const { centers } = kMeansClusters(pixels, k)
  return centers.map(([r, g, b]) => rgbToHex(r, g, b))
}
