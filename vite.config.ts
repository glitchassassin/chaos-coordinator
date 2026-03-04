import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    preact(),
    devServer({
      adapter: nodeAdapter,
      entry: "src/server/app.ts",
      // Only let Hono handle API/auth routes; Vite serves everything else
      exclude: [/^\/(?!(api|login|logout|health)($|\/))/],
    }),
  ],
  root: "src/client",
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
});
