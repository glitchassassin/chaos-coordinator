import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import {
  resolvePassword,
  authMiddleware,
  loginPage,
  checkPassword,
  createSessionCookie,
  clearSessionCookie,
} from "./auth.js";
import { initInstances, getInstances } from "./instances.js";
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

serve({ fetch: app.fetch, port }, () => {
  console.log(`Chaos Coordinator listening on http://localhost:${port}`);
});

export default app;
