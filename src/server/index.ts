import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import {
  resolvePassword,
  authMiddleware,
  loginPage,
  checkPassword,
  createSessionCookie,
  clearSessionCookie,
} from "./auth.js";
import { initInstances, getInstances, getInstance, addInstance, removeInstance } from "./instances.js";
import { spawnInstance, killInstance, getNextPort } from "./process-manager.js";
import { proxy } from "./proxy.js";

const app = new Hono();

// Health check (no auth)
app.get("/health", (c) => c.json({ ok: true }));

// Login routes (no auth)
app.get("/login", (c) => c.html(loginPage()));
app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const pw = typeof body.password === "string" ? body.password : "";
  if (!checkPassword(pw)) {
    return c.html(loginPage("Wrong password."), 401);
  }
  createSessionCookie(c);
  return c.redirect("/");
});

app.get("/logout", (c) => {
  clearSessionCookie(c);
  return c.redirect("/login");
});

// Everything below requires auth
app.use("/api/*", authMiddleware);
app.use("/*", async (c, next) => {
  // Let static assets and API through, protect the SPA shell
  const path = c.req.path;
  if (
    path.startsWith("/api/") ||
    path === "/login" ||
    path === "/logout" ||
    path === "/health" ||
    path.match(/\.\w+$/) // static files with extensions
  ) {
    return next();
  }
  return authMiddleware(c, next);
});

// Instance registry API
app.get("/api/instances", (c) => c.json(getInstances()));

// Create instance
app.post("/api/instances", async (c) => {
  const body = await c.req.json<{ directory: string; name?: string }>();
  const { directory, name } = body;

  if (!directory || !existsSync(directory)) {
    return c.json({ error: "Directory does not exist" }, 400);
  }

  const id = `instance-${Date.now()}`;
  const port = getNextPort();
  const instanceName = name?.trim() || basename(directory);

  const instance = { id, name: instanceName, port, directory };
  addInstance(instance);
  spawnInstance(id, directory, port);

  return c.json(instance, 201);
});

// Delete instance
app.delete("/api/instances/:id", (c) => {
  const id = c.req.param("id");
  const instance = getInstance(id);
  if (!instance) {
    return c.json({ error: "Instance not found" }, 404);
  }
  killInstance(id);
  removeInstance(id);
  return new Response(null, { status: 204 });
});

// Filesystem listing API
app.get("/api/fs", (c) => {
  const home = homedir();
  const rawPath = c.req.query("path") || home;

  // Security: path must be within home directory
  const safePath = rawPath.startsWith(home) ? rawPath : home;

  let entries: { name: string; path: string }[] = [];
  try {
    const items = readdirSync(safePath);
    entries = items
      .filter((item) => {
        try {
          return statSync(join(safePath, item)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((item) => ({ name: item, path: join(safePath, item) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    return c.json({ error: "Cannot read directory" }, 400);
  }

  return c.json({ path: safePath, entries });
});

// Reverse proxy to opencode instances
app.route("/api/instances", proxy);

// Static files (production build)
app.use(
  "/*",
  serveStatic({
    root: "./dist/client",
  }),
);

// SPA fallback — serve index.html for client-side routes
app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));

// Boot
initInstances();
resolvePassword();

const port = parseInt(process.env.PORT || "3000", 10);

const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`Chaos Coordinator listening on http://${hostname}:${port}`);
});

export default app;
