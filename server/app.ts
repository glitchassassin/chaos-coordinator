import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";
import { createNodeWebSocket } from "@hono/node-ws";
import { setupWs } from "./ws.js";

const BUILD_PATH = "../build/server/index.js";
const PORT = Number(process.env.PORT ?? 5173);

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// WebSocket endpoint for live log streaming
setupWs(app, upgradeWebSocket);

// Serve all static client assets (falls through to React Router for non-files)
app.use(serveStatic({ root: "./build/client" }));

// React Router handler (loaded at startup)
const build = (await import(BUILD_PATH)) as ServerBuild;
const handler = createRequestHandler(build);

app.all("*", (c) => handler(c.req.raw));

const server = serve({ fetch: app.fetch.bind(app), port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

injectWebSocket(server);
