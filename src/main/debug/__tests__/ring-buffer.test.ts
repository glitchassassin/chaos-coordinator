import { describe, it, expect } from 'vitest'
import { RingBuffer } from '../ring-buffer'

describe('RingBuffer', () => {
  it('throws for capacity < 1', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError)
  })

  it('returns empty array when empty', () => {
    const buf = new RingBuffer<number>(3)
    expect(buf.toArray()).toEqual([])
    expect(buf.size).toBe(0)
  })

  it('stores items in insertion order when not full', () => {
    const buf = new RingBuffer<number>(5)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    expect(buf.toArray()).toEqual([1, 2, 3])
    expect(buf.size).toBe(3)
  })

  it('overwrites oldest when full', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    buf.push(4) // overwrites 1
    expect(buf.toArray()).toEqual([2, 3, 4])
    expect(buf.size).toBe(3)
  })

  it('toArray returns oldest-first after wrapping', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(10)
    buf.push(20)
    buf.push(30)
    buf.push(40) // overwrites 10
    buf.push(50) // overwrites 20
    expect(buf.toArray()).toEqual([30, 40, 50])
  })

  it('clear resets the buffer', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.clear()
    expect(buf.size).toBe(0)
    expect(buf.toArray()).toEqual([])
  })

  it('works correctly after clear and re-fill', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.clear()
    buf.push(10)
    buf.push(20)
    expect(buf.toArray()).toEqual([10, 20])
  })

  it('handles capacity of 1', () => {
    const buf = new RingBuffer<string>(1)
    buf.push('a')
    buf.push('b')
    expect(buf.toArray()).toEqual(['b'])
    expect(buf.size).toBe(1)
  })
})
