import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { wsPlugin } from "./server/vite-ws-plugin.js";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), wsPlugin()],
});
