import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";

const BUILD_PATH = "../build/server/index.js";
const PORT = Number(process.env.PORT ?? 5173);

const app = new Hono();

// Serve static client assets
app.use("/assets/*", serveStatic({ root: "./build/client" }));
app.use("/favicon.ico", serveStatic({ path: "./build/client/favicon.ico" }));

// React Router handler (loaded at startup)
const build = (await import(BUILD_PATH)) as ServerBuild;
const handler = createRequestHandler(build);

app.all("*", (c) => handler(c.req.raw));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
