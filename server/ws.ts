import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { watchLog, readLog } from "./logs.js";

export { createNodeWebSocket };

// ── Minimal WebSocket interface ────────────────────────────────────────────────

/** Minimal WebSocket interface shared between Hono WSContext and raw ws.WebSocket. */
export interface WsLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

// ── Core tracking logic ────────────────────────────────────────────────────────

/** Key for tracking clients: "sessionId:encodedDir" */
type ClientKey = string;
function clientKey(sessionId: string, encodedDir: string): ClientKey {
  return `${sessionId}:${encodedDir}`;
}

// Active clients per key
const clients = new Map<ClientKey, Set<WsLike>>();
// Active file watchers per key
const watchers = new Map<ClientKey, () => void>();

function getClients(key: ClientKey): Set<WsLike> {
  let set = clients.get(key);
  if (!set) {
    set = new Set();
    clients.set(key, set);
  }
  return set;
}

function send(ws: WsLike, data: unknown): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* ignore closed connections */
  }
}

export function logPathFor(sessionId: string, encodedDir: string): string {
  return path.join(
    os.homedir(),
    ".claude",
    "projects",
    encodedDir,
    `${sessionId}.jsonl`,
  );
}

function startFileWatcher(key: ClientKey, logPath: string): void {
  if (watchers.has(key)) return;
  const unwatch = watchLog(logPath, (entries) => {
    for (const ws of getClients(key)) {
      send(ws, { type: "entries", entries });
    }
  });
  watchers.set(key, unwatch);
}

/**
 * Ensure a watcher is running for the given log path.
 * If the file doesn't exist yet (new agent), poll every 2s until it appears,
 * then switch to the real file watcher.
 */
function ensureWatcher(key: ClientKey, logPath: string): void {
  if (watchers.has(key)) return;

  if (fs.existsSync(logPath)) {
    startFileWatcher(key, logPath);
    return;
  }

  // File doesn't exist yet — poll for its creation
  const timer = setInterval(() => {
    if (!fs.existsSync(logPath)) return;
    clearInterval(timer);

    // Broadcast initial entries to all connected clients
    const entries = readLog(logPath);
    for (const ws of getClients(key)) {
      send(ws, { type: "entries", entries });
    }

    // Replace the polling cleanup with the real file watcher
    watchers.delete(key);
    startFileWatcher(key, logPath);
  }, 2_000);

  watchers.set(key, () => { clearInterval(timer); });
}

function cleanup(key: ClientKey, ws: WsLike): void {
  const clientSet = getClients(key);
  clientSet.delete(ws);
  if (clientSet.size === 0) {
    watchers.get(key)?.();
    watchers.delete(key);
    clients.delete(key);
  }
}

/** Register a WebSocket client for a conversation. Sends initial entries and starts watching. */
export function handleWsOpen(ws: WsLike, sessionId: string, encodedDir: string): void {
  if (!sessionId || !encodedDir) {
    ws.close(1008, "sessionId and dir required");
    return;
  }
  const key = clientKey(sessionId, encodedDir);
  getClients(key).add(ws);

  const logPath = logPathFor(sessionId, encodedDir);

  // Send current entries if the file already exists
  if (fs.existsSync(logPath)) {
    send(ws, { type: "entries", entries: readLog(logPath) });
  }

  ensureWatcher(key, logPath);
}

/** Unregister a WebSocket client. Cleans up watchers when last client disconnects. */
export function handleWsClose(ws: WsLike, sessionId: string, encodedDir: string): void {
  cleanup(clientKey(sessionId, encodedDir), ws);
}

// ── Hono integration (production server) ───────────────────────────────────────

export function setupWs(
  app: Hono,
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
): void {
  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const sessionId = c.req.query("sessionId") ?? "";
      const encodedDir = c.req.query("dir") ?? "";

      return {
        onOpen(_event, ws) {
          handleWsOpen(ws, sessionId, encodedDir);
        },
        onClose(_event, ws) {
          handleWsClose(ws, sessionId, encodedDir);
        },
        onError(_event, ws) {
          handleWsClose(ws, sessionId, encodedDir);
        },
      };
    }),
  );
}
