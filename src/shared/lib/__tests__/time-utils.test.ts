import { describe, it, expect } from 'vitest'
import { formatDuration, timeElapsed } from '../time-utils'

describe('formatDuration', () => {
  it('returns "< 1h" for durations under 1 hour', () => {
    expect(formatDuration(0)).toBe('< 1h')
    expect(formatDuration(30 * 60 * 1000)).toBe('< 1h')
    expect(formatDuration(59 * 60 * 1000)).toBe('< 1h')
  })

  it('returns hours for durations under 1 day', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h')
    expect(formatDuration(4 * 60 * 60 * 1000)).toBe('4h')
    expect(formatDuration(23 * 60 * 60 * 1000)).toBe('23h')
  })

  it('returns days for durations under 1 week', () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe('1d')
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe('3d')
    expect(formatDuration(6 * 24 * 60 * 60 * 1000)).toBe('6d')
  })

  it('returns weeks for durations of 7+ days', () => {
    expect(formatDuration(7 * 24 * 60 * 60 * 1000)).toBe('1w')
    expect(formatDuration(14 * 24 * 60 * 60 * 1000)).toBe('2w')
    expect(formatDuration(21 * 24 * 60 * 60 * 1000)).toBe('3w')
  })
})

describe('timeElapsed', () => {
  it('returns formatted duration since the given timestamp', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(timeElapsed(twoHoursAgo)).toBe('2h')
  })

  it('returns "< 1h" for a recent timestamp', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(timeElapsed(fiveMinutesAgo)).toBe('< 1h')
  })
})
