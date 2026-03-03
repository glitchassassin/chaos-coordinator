import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";
import { getDb } from "../db/client.js";
import { reconcileAgents, startPolling } from "./agents.js";

const BUILD_PATH = "../build/server/index.js";
const PORT = Number(process.env.PORT ?? 5173);

// Initialize DB, reconcile existing tmux sessions, and start status polling
getDb();
reconcileAgents();
startPolling();

const app = new Hono();

// Serve all static client assets (falls through to React Router for non-files)
app.use(serveStatic({ root: "./build/client" }));

// React Router handler (loaded at startup)
const build = (await import(BUILD_PATH)) as ServerBuild;
const handler = createRequestHandler(build);

app.all("*", (c) => handler(c.req.raw));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
