import { serve } from "@hono/node-server";
import { execSync } from "node:child_process";
import app from "./app.js";

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`Chaos Coordinator listening on http://${hostname}:${port}`);
  try {
    execSync(`tailscale serve --bg http://localhost:${port}`, { stdio: "inherit" });
  } catch {
    // tailscale not available — ignore
  }
});

function shutdown() {
  try { execSync("tailscale serve --https=443 off", { stdio: "ignore" }); } catch {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
