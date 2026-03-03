import { WebSocketServer, type WebSocket } from "ws";
import type { Plugin } from "vite";
import { handleWsOpen, handleWsClose } from "./ws.js";

/**
 * Vite plugin that adds a WebSocket server for live conversation log streaming.
 * Handles `/ws?sessionId=...&dir=...` upgrade requests on the dev server.
 */
export function wsPlugin(): Plugin {
  return {
    name: "chaos-coordinator-ws",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        // Only handle our /ws endpoint; let Vite's HMR handle /@vite/client etc.
        const url = new URL(req.url ?? "", `http://${req.headers.host}`);
        if (url.pathname !== "/ws") return;

        const sessionId = url.searchParams.get("sessionId") ?? "";
        const encodedDir = url.searchParams.get("dir") ?? "";

        wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          handleWsOpen(ws, sessionId, encodedDir);

          ws.on("close", () => {
            handleWsClose(ws, sessionId, encodedDir);
          });
          ws.on("error", () => {
            handleWsClose(ws, sessionId, encodedDir);
          });
        });
      });
    },
  };
}
