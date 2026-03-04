import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

function detectGitRemote(directory: string): "github" | "azuredevops" | undefined {
  try {
    const config = readFileSync(join(directory, ".git", "config"), "utf-8");
    if (config.includes("github.com")) return "github";
    if (config.includes("dev.azure.com") || config.includes("visualstudio.com")) return "azuredevops";
  } catch {
    // not a git repo or no remote
  }
  return undefined;
}
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
import { spawnInstance, killInstance, getNextPort, reservePort } from "./process-manager.js";
import { proxy } from "./proxy.js";

// Initialize once — safe to call multiple times (guarded internally)
if (!(globalThis as any).__appInitialized) {
  (globalThis as any).__appInitialized = true;
  initInstances();
  resolvePassword();

  // Re-spawn persisted instances from previous session
  for (const inst of getInstances()) {
    reservePort(inst.port);
    spawnInstance(inst.id, inst.directory, inst.port);
  }
}

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

// In production, also protect the SPA shell
if (process.env.NODE_ENV !== "development") {
  app.use("/*", async (c, next) => {
    const path = c.req.path;
    if (
      path.startsWith("/api/") ||
      path === "/login" ||
      path === "/logout" ||
      path === "/health" ||
      path.match(/\.\w+$/)
    ) {
      return next();
    }
    return authMiddleware(c, next);
  });
}

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

  const remote = detectGitRemote(directory);
  const instance = { id, name: instanceName, port, directory, ...(remote ? { remote } : {}) };
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
  const safePath = rawPath.startsWith(home) ? rawPath : home;
  const includeFiles = c.req.query("files") === "1";

  let entries: { name: string; path: string; type: "file" | "directory" }[] = [];
  try {
    const items = readdirSync(safePath);
    for (const item of items) {
      if (item.startsWith(".")) continue;
      try {
        const stat = statSync(join(safePath, item));
        const isDir = stat.isDirectory();
        if (isDir || (includeFiles && stat.isFile())) {
          entries.push({ name: item, path: join(safePath, item), type: isDir ? "directory" : "file" });
        }
      } catch {
        // skip unreadable entries
      }
    }
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return c.json({ error: "Cannot read directory" }, 400);
  }

  return c.json({ path: safePath, entries });
});

// File read API
app.get("/api/fs/content", (c) => {
  const home = homedir();
  const rawPath = c.req.query("path");
  if (!rawPath || !rawPath.startsWith(home)) {
    return c.json({ error: "Invalid path" }, 400);
  }
  try {
    const stat = statSync(rawPath);
    if (!stat.isFile()) return c.json({ error: "Not a file" }, 400);
    if (stat.size > 1024 * 1024) return c.json({ content: "", binary: true });
    const buf = readFileSync(rawPath);
    const isBinary = buf.some((b) => b === 0);
    if (isBinary) return c.json({ content: "", binary: true });
    return c.json({ content: buf.toString("utf-8"), binary: false });
  } catch {
    return c.json({ error: "Cannot read file" }, 400);
  }
});

// Reverse proxy to opencode instances
app.route("/api/instances", proxy);

// Static files — production only (dev uses Vite)
if (process.env.NODE_ENV !== "development") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

export default app;
