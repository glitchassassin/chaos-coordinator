import { webContents } from 'electron'
import type { WebContents } from 'electron'
import type {
  DebugEvent,
  DebugEventType,
  LogEvent,
  AsyncTaskEvent,
  IpcTrafficEvent
} from '../../shared/types/debug'
import { DEBUG_PUSH_CHANNEL } from '../../shared/types/debug'
import { RingBuffer } from './ring-buffer'

const BUFFER_CAPACITY = 1000

// Distributive Omit — correctly removes 'id' and 'timestamp' from each union member
export type EmitPayload =
  | Omit<LogEvent, 'id' | 'timestamp'>
  | Omit<AsyncTaskEvent, 'id' | 'timestamp'>
  | Omit<IpcTrafficEvent, 'id' | 'timestamp'>

interface Subscriber {
  id: number
  types?: DebugEventType[]
}

export class DebugEventBus {
  private readonly buffer = new RingBuffer<DebugEvent>(BUFFER_CAPACITY)
  private subscribers: Subscriber[] = []
  private nextId = 1

  emit(event: EmitPayload): void {
    const full = {
      ...event,
      id: this.nextId++,
      timestamp: Date.now()
    } as DebugEvent

    this.buffer.push(full)
    this.pushToSubscribers(full)
  }

  private pushToSubscribers(event: DebugEvent): void {
    if (this.subscribers.length === 0) return

    // Clean up destroyed webContents and push to live ones
    this.subscribers = this.subscribers.filter((sub) => {
      try {
        const wc = webContents.fromId(sub.id)
        if (!wc || wc.isDestroyed()) return false
        if (sub.types && !sub.types.includes(event.type)) return true // keep but don't send
        wc.send(DEBUG_PUSH_CHANNEL, event)
        return true
      } catch {
        return false
      }
    })
  }

  subscribe(wc: WebContents, types?: DebugEventType[]): DebugEvent[] {
    // Remove any existing subscription for this webContents
    this.unsubscribe(wc)
    const sub: Subscriber = { id: wc.id }
    if (types !== undefined) {
      sub.types = types
    }
    this.subscribers.push(sub)
    return this.buffer.toArray()
  }

  unsubscribe(wc: WebContents): void {
    this.subscribers = this.subscribers.filter((sub) => sub.id !== wc.id)
  }

  getSnapshot(): DebugEvent[] {
    return this.buffer.toArray()
  }

  clear(): void {
    this.buffer.clear()
  }
}

export const debugEventBus = new DebugEventBus()
