import type { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { createNodeWebSocket } from "@hono/node-ws";
import { watchLog, readLog, findAgentLog } from "./logs.js";
import { getAgent } from "./agents.js";
import { getProject } from "./projects.js";

export { createNodeWebSocket };

// Active clients per agentId
const clients = new Map<string, Set<WSContext>>();
// Active file watchers per agentId
const watchers = new Map<string, () => void>();

function getClients(agentId: string): Set<WSContext> {
  if (!clients.has(agentId)) clients.set(agentId, new Set());
  return clients.get(agentId)!;
}

function send(ws: WSContext, data: unknown): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* ignore closed connections */
  }
}

function startWatcher(agentId: string, logPath: string): void {
  if (watchers.has(agentId)) return;
  const unwatch = watchLog(logPath, (entries) => {
    for (const ws of getClients(agentId)) {
      send(ws, { type: "entries", entries });
    }
  });
  watchers.set(agentId, unwatch);
}

function cleanup(agentId: string, ws: WSContext): void {
  const clientSet = getClients(agentId);
  clientSet.delete(ws);
  if (clientSet.size === 0) {
    watchers.get(agentId)?.();
    watchers.delete(agentId);
    clients.delete(agentId);
  }
}

export function setupWs(
  app: Hono,
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
): void {
  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const agentId = c.req.query("agentId") ?? "";
      return {
        onOpen(_event, ws) {
          if (!agentId) {
            ws.close(1008, "agentId required");
            return;
          }
          getClients(agentId).add(ws);

          const agent = getAgent(agentId);
          if (!agent) return;
          const project = getProject(agent.projectId);
          if (!project) return;

          const logPath =
            agent.logPath ?? findAgentLog(project.directory, agent.createdAt);
          if (!logPath) return;

          // Send current entries immediately
          send(ws, { type: "entries", entries: readLog(logPath) });
          startWatcher(agentId, logPath);
        },
        onClose(_event, ws) {
          if (agentId) cleanup(agentId, ws);
        },
        onError(_event, ws) {
          if (agentId) cleanup(agentId, ws);
        },
      };
    }),
  );
}
