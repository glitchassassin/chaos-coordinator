import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  root: "src/client",
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/login": "http://localhost:3000",
      "/logout": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
