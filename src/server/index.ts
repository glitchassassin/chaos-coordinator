import { serve } from "@hono/node-server";
import app from "./app.js";

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`Chaos Coordinator listening on http://${hostname}:${port}`);
});
