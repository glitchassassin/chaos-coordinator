import { useEffect, useRef, useCallback, useState } from "preact/hooks";
import { instanceUrl } from "./use-api.js";
import type { SSEEvent } from "../types.js";

type Listener = (event: SSEEvent) => void;

export function useSSE(
  instanceId: string | null,
  onEvent: Listener,
) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Buffer events and flush on idle to reduce e-ink redraws
  const bufferRef = useRef<SSEEvent[]>([]);
  const flushScheduled = useRef(false);

  const flush = useCallback(() => {
    const batch = bufferRef.current.splice(0);
    for (const evt of batch) {
      onEventRef.current(evt);
    }
    flushScheduled.current = false;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(flush, { timeout: 100 });
    } else {
      setTimeout(flush, 50);
    }
  }, [flush]);

  useEffect(() => {
    if (!instanceId) return;

    // Global SSE endpoint — one per opencode instance
    const url = instanceUrl(instanceId, "/event");
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const parsed: SSEEvent = JSON.parse(e.data);
        if (parsed.type && parsed.properties) {
          bufferRef.current.push(parsed);
          scheduleFlush();
        }
      } catch {
        // ignore unparseable
      }
    };

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [instanceId, scheduleFlush]);

  return { connected };
}
