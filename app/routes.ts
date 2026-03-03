import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design-system", "routes/design-system.tsx"),
  route("projects/:encodedDir", "routes/projects.$encodedDir.tsx"),
  route(
    "projects/:encodedDir/conversations/:sessionId",
    "routes/projects.$encodedDir.conversations.$sessionId.tsx",
  ),
] satisfies RouteConfig;
