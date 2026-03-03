import type { Route } from "./+types/api.projects.$id";
import { removeProject } from "../../server/projects.js";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  removeProject(params.id);
  return Response.json({ ok: true });
}
