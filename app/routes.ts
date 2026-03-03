import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design-system", "routes/design-system.tsx"),
  route("agents/:id", "routes/agents.$id.tsx"),
] satisfies RouteConfig;
