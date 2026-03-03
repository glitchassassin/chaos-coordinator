import type { Route } from "./+types/api.projects";
import { listProjects, addProject } from "../../server/projects.js";

export async function loader(_args: Route.LoaderArgs) {
  return Response.json(listProjects());
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = (await request.json()) as { directory?: string };
  const directory = body.directory?.trim();
  if (!directory) {
    return Response.json({ error: "directory required" }, { status: 400 });
  }
  try {
    return Response.json(addProject(directory), { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
