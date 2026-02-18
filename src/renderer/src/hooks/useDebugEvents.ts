import { useEffect, useState } from 'react'
import type { DebugEvent } from '../../../shared/types/debug'
import { DEBUG_PUSH_CHANNEL } from '../../../shared/types/debug'

const RENDERER_CAP = 500

export function useDebugEvents() {
  const [events, setEvents] = useState<DebugEvent[]>([])

  useEffect(() => {
    let mounted = true

    void window.api.invoke('debug:subscribe', undefined).then(({ events: snapshot }) => {
      if (!mounted) return
      setEvents(snapshot.slice(-RENDERER_CAP))
    })

    window.api.on(DEBUG_PUSH_CHANNEL, (event) => {
      if (!mounted) return
      setEvents((prev) => {
        const next = [...prev, event]
        return next.length > RENDERER_CAP ? next.slice(next.length - RENDERER_CAP) : next
      })
    })

    return () => {
      mounted = false
      window.api.off(DEBUG_PUSH_CHANNEL)
      void window.api.invoke('debug:unsubscribe')
    }
  }, [])

  return events
}
