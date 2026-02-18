/**
 * Generic bounded ring buffer. When full, the oldest entry is overwritten.
 */
export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[]
  private head = 0 // points to the oldest slot (or next write when not full)
  private count = 0
  readonly capacity: number

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('capacity must be >= 1')
    this.capacity = capacity
    this.buffer = new Array<T | undefined>(capacity).fill(undefined)
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) {
      this.count++
    }
  }

  /** Returns all items oldest-first. */
  toArray(): T[] {
    if (this.count === 0) return []
    if (this.count < this.capacity) {
      // Buffer not yet full — items start at index 0
      return this.buffer.slice(0, this.count) as T[]
    }
    // Buffer full — head points to the oldest slot
    const tail = this.buffer.slice(this.head) as T[]
    const front = this.buffer.slice(0, this.head) as T[]
    return [...tail, ...front]
  }

  clear(): void {
    this.buffer.fill(undefined)
    this.head = 0
    this.count = 0
  }

  get size(): number {
    return this.count
  }
}
