import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { createNodeWebSocket } from "@hono/node-ws";
import { watchLog, readLog } from "./logs.js";

export { createNodeWebSocket };

/** Key for tracking clients: "sessionId:encodedDir" */
type ClientKey = string;
function clientKey(sessionId: string, encodedDir: string): ClientKey {
  return `${sessionId}:${encodedDir}`;
}

// Active clients per key
const clients = new Map<ClientKey, Set<WSContext>>();
// Active file watchers per key
const watchers = new Map<ClientKey, () => void>();

function getClients(key: ClientKey): Set<WSContext> {
  let set = clients.get(key);
  if (!set) {
    set = new Set();
    clients.set(key, set);
  }
  return set;
}

function send(ws: WSContext, data: unknown): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* ignore closed connections */
  }
}

function resolveLogPath(sessionId: string, encodedDir: string): string | null {
  const logPath = path.join(
    os.homedir(),
    ".claude",
    "projects",
    encodedDir,
    `${sessionId}.jsonl`,
  );
  try {
    fs.accessSync(logPath);
    return logPath;
  } catch {
    return null;
  }
}

function startWatcher(key: ClientKey, logPath: string): void {
  if (watchers.has(key)) return;
  const unwatch = watchLog(logPath, (entries) => {
    for (const ws of getClients(key)) {
      send(ws, { type: "entries", entries });
    }
  });
  watchers.set(key, unwatch);
}

function cleanup(key: ClientKey, ws: WSContext): void {
  const clientSet = getClients(key);
  clientSet.delete(ws);
  if (clientSet.size === 0) {
    watchers.get(key)?.();
    watchers.delete(key);
    clients.delete(key);
  }
}

export function setupWs(
  app: Hono,
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
): void {
  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const sessionId = c.req.query("sessionId") ?? "";
      const encodedDir = c.req.query("dir") ?? "";
      const key = clientKey(sessionId, encodedDir);

      return {
        onOpen(_event, ws) {
          if (!sessionId || !encodedDir) {
            ws.close(1008, "sessionId and dir required");
            return;
          }
          getClients(key).add(ws);

          const logPath = resolveLogPath(sessionId, encodedDir);
          if (!logPath) return;

          // Send current entries immediately
          send(ws, { type: "entries", entries: readLog(logPath) });
          startWatcher(key, logPath);
        },
        onClose(_event, ws) {
          if (key) cleanup(key, ws);
        },
        onError(_event, ws) {
          if (key) cleanup(key, ws);
        },
      };
    }),
  );
}
