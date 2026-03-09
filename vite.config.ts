import { defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import { resolve } from "path";
import { execSync } from "node:child_process";

export default defineConfig(({ mode }) => {
  // Load .env into process.env so the Hono server can read them
  const env = loadEnv(mode, resolve(__dirname), "");
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [
      preact(),
      {
        name: "tailscale-serve",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            const addr = server.httpServer!.address();
            const port = typeof addr === "object" && addr ? addr.port : 5173;
            try {
              execSync(`tailscale serve --bg http://localhost:${port}`, { stdio: "inherit" });
            } catch {
              // tailscale not available — ignore
            }
          });
          server.httpServer?.once("close", () => {
            try { execSync("tailscale serve --https=443 off", { stdio: "ignore" }); } catch {}
          });
        },
      },
      devServer({
        adapter: nodeAdapter,
        entry: "src/server/app.ts",
        // Only let Hono handle API/auth routes; Vite serves everything else
        exclude: [/^\/(?!(api|login|logout|health)($|\/))/],
      }),
    ],
    server: {
      allowedHosts: true,
    },
    root: "src/client",
    envDir: resolve(__dirname),
    build: {
      outDir: resolve(__dirname, "dist/client"),
      emptyOutDir: true,
    },
  };
});
