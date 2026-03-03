import { Hono } from "hono";
import { getInstance } from "./instances.js";

const proxy = new Hono();

proxy.all("/:id/*", async (c) => {
  const id = c.req.param("id");
  const instance = getInstance(id);
  if (!instance) {
    return c.json({ error: "Instance not found" }, 404);
  }

  // Strip /api/instances/:id prefix to get the path to forward
  const url = new URL(c.req.url);
  const prefix = `/api/instances/${id}`;
  const rest = url.pathname.slice(prefix.length) || "/";
  const target = `http://127.0.0.1:${instance.port}${rest}${url.search}`;

  // Forward headers, drop host
  const headers = new Headers(c.req.raw.headers);
  headers.delete("host");

  const isSSE =
    rest === "/event" ||
    rest === "/global/event" ||
    rest.endsWith("/event");

  try {
    const upstream = await fetch(target, {
      method: c.req.method,
      headers,
      body:
        c.req.method !== "GET" && c.req.method !== "HEAD"
          ? c.req.raw.body
          : undefined,
      duplex: "half",
    });

    if (isSSE && upstream.body) {
      // Stream SSE without buffering
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch (e) {
    return c.json(
      { error: "Failed to reach instance", detail: String(e) },
      502,
    );
  }
});

export { proxy };
