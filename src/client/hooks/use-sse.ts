import { useEffect, useRef, useCallback } from "preact/hooks";
import { instanceUrl } from "./use-api.js";
import type { SSEEvent } from "../types.js";

type Listener = (event: SSEEvent, instanceId: string) => void;

export function useSSE(
  instanceIds: string[],
  onEvent: Listener,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Buffer events and flush on idle to reduce e-ink redraws
  const bufferRef = useRef<Array<{ evt: SSEEvent; instanceId: string }>>([]);
  const flushScheduled = useRef(false);

  const flush = useCallback(() => {
    const batch = bufferRef.current.splice(0);
    for (const { evt, instanceId } of batch) {
      onEventRef.current(evt, instanceId);
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

  const key = instanceIds.join(",");

  useEffect(() => {
    if (instanceIds.length === 0) return;

    const sources = instanceIds.map((instanceId) => {
      const url = instanceUrl(instanceId, "/event");
      const es = new EventSource(url);

      es.onmessage = (e) => {
        try {
          const parsed: SSEEvent = JSON.parse(e.data);
          if (parsed.type && parsed.properties) {
            bufferRef.current.push({ evt: parsed, instanceId });
            scheduleFlush();
          }
        } catch {
          // ignore unparseable
        }
      };

      return es;
    });

    return () => {
      for (const es of sources) es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scheduleFlush]);
}
