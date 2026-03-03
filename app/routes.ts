import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design-system", "routes/design-system.tsx"),
  route("api/projects", "routes/api.projects.ts"),
  route("api/projects/:id", "routes/api.projects.$id.ts"),
] satisfies RouteConfig;
