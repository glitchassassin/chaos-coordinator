import { Form } from "react-router";
import type { Route } from "./+types/home";
import { useDoubleCheck } from "~/utils/misc";
import { listProjects, addProject, removeProject } from "../../server/projects.js";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Chaos Coordinator" },
    { name: "description", content: "Claude Code orchestrator" },
  ];
}

export function loader(_args: Route.LoaderArgs) {
  return { projects: listProjects() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add") {
    const directory = (form.get("directory") as string | null)?.trim() ?? "";
    if (!directory) {
      return { intent: "add" as const, error: "Directory path is required." };
    }
    try {
      addProject(directory);
      return { intent: "add" as const, ok: true as const, ts: Date.now() };
    } catch (err) {
      return { intent: "add" as const, error: (err as Error).message };
    }
  }

  if (intent === "remove") {
    const id = form.get("id") as string;
    removeProject(id);
    return { intent: "remove" as const, ok: true as const };
  }

  return null;
}

// ── Provider icons ────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg
      aria-label="GitHub"
      role="img"
      viewBox="0 0 16 16"
      width="24"
      height="24"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
           0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
           -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
           .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
           -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
           .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
           .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
           0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8
           c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

function AzureDevOpsIcon() {
  return (
    <svg
      aria-label="Azure DevOps"
      role="img"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
    >
      <path d="M4.732.001a4.732 4.732 0 0 0-4.647 5.684L4.087 5.65a.716.716 0 0 1
               .703-.587h7.42l-7.478 7.478-4.647.034A4.736 4.736 0 0 0 4.732 24h14.536
               a4.74 4.74 0 0 0 4.647-5.684l-4.001-.035a.719.719 0 0 1-.703.587H11.79
               l7.478-7.478 4.646-.034A4.736 4.736 0 0 0 19.268.001z" />
    </svg>
  );
}

function ProviderIcon({ type }: { type: string }) {
  return type === "github" ? <GitHubIcon /> : <AzureDevOpsIcon />;
}

// ── Project row ───────────────────────────────────────────────────────────────

type Project = Awaited<ReturnType<typeof loader>>["projects"][number];

const removeBtn: React.CSSProperties = {
  padding: "0 0.75rem",
  border: "3px solid #c62828",
  background: "#c62828",
  color: "#ffffff",
  cursor: "pointer",
};


function ProjectRow({ project }: { project: Project }) {
  const dc = useDoubleCheck();

  return (
    <div
      className="border-t-ui"
      data-testid="project-row"
      data-dir={project.directory}
      style={{
        padding: "0.75rem 0",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
      }}
    >
      {/* Provider icon or placeholder to keep text aligned */}
      <div style={{ flexShrink: 0, width: 24, paddingTop: "0.2rem", color: "#555555" }}>
        {project.providerType && <ProviderIcon type={project.providerType} />}
      </div>

      {/* Name + directory */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{project.name}</div>
        <div
          className="font-mono"
          style={{ color: "#555555", fontSize: "0.875rem", wordBreak: "break-all" }}
        >
          {project.directory}
        </div>
      </div>

      {/* Remove (double-check) */}
      <Form method="post" style={{ flexShrink: 0 }}>
        <input type="hidden" name="intent" value="remove" />
        <input type="hidden" name="id" value={project.id} />
        <button type="submit" {...dc.getButtonProps()} style={removeBtn}>
          {dc.doubleCheck ? "Confirm?" : "Remove"}
        </button>
      </Form>
    </div>
  );
}

// ── Add Project form ──────────────────────────────────────────────────────────

function AddProjectForm({ formKey, error }: { formKey: number; error?: string }) {
  return (
    <Form method="post" key={formKey} style={{ marginBottom: "1.5rem" }}>
      <input type="hidden" name="intent" value="add" />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          name="directory"
          placeholder="Absolute path to project directory"
          required
          aria-label="Project directory path"
          style={{
            flex: 1,
            minWidth: 200,
            padding: "0 0.75rem",
            border: "3px solid #888888",
            background: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0 1rem",
            border: "3px solid #888888",
            background: "none",
            cursor: "pointer",
          }}
        >
          Add Project
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: "#c62828", margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}
    </Form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { projects } = loaderData;

  const addError =
    actionData?.intent === "add" && "error" in actionData ? actionData.error : undefined;
  const formKey =
    actionData?.intent === "add" && "ts" in actionData ? actionData.ts : 0;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Projects</h1>

      <AddProjectForm formKey={formKey} error={addError} />

      {projects.length === 0 ? (
        <p style={{ color: "#555555" }}>No projects yet. Add a directory above.</p>
      ) : (
        <div>
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
