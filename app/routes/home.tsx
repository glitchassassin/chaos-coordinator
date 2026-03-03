import type { Route } from "./+types/home";
import { listProjects } from "../../server/projects.js";
import { listAgents, type RunningAgent } from "../../server/agents.js";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Chaos Coordinator" },
    { name: "description", content: "Claude Code orchestrator" },
  ];
}

export function loader(_args: Route.LoaderArgs) {
  return {
    projects: listProjects(),
    agents: listAgents(),
  };
}

// ── Provider icons ─────────────────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────────

type Project = Awaited<ReturnType<typeof loader>>["projects"][number];

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: "#2e7d32",
  idle: "#555555",
  waiting: "#f57f17",
  starting: "#555555",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#555555";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.375rem",
        border: `2px solid ${color}`,
        color,
        fontSize: "0.6875rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

// ── Agent summary ──────────────────────────────────────────────────────────────

function AgentSummary({ agents }: { agents: RunningAgent[] }) {
  if (agents.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {agents.map((a) => (
        <StatusBadge key={a.id} status={a.status} />
      ))}
      <span style={{ color: "#555555", fontSize: "0.8125rem" }}>
        {agents.length} running agent{agents.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ── Project row ────────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  agents,
}: {
  project: Project;
  agents: RunningAgent[];
}) {
  return (
    <a
      href={`/projects/${project.encodedDir}`}
      data-testid="project-row"
      data-dir={project.directory}
      className="border-t-ui"
      style={{
        display: "block",
        padding: "0.75rem 0",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <div style={{ flexShrink: 0, width: 24, paddingTop: "0.2rem", color: "#555555" }}>
          {project.providerType && <ProviderIcon type={project.providerType} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{project.name}</div>
          <div
            className="font-mono"
            style={{ color: "#555555", fontSize: "0.875rem", wordBreak: "break-all" }}
          >
            {project.directory}
          </div>
          <div style={{ marginTop: "0.375rem" }}>
            <AgentSummary agents={agents} />
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home({ loaderData }: Route.ComponentProps) {
  const { projects, agents } = loaderData;

  // Group agents by encodedDir
  const agentsByDir = new Map<string, RunningAgent[]>();
  for (const agent of agents) {
    const list = agentsByDir.get(agent.encodedDir) ?? [];
    list.push(agent);
    agentsByDir.set(agent.encodedDir, list);
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Projects</h1>

      {projects.length === 0 ? (
        <p style={{ color: "#555555" }}>
          No projects found. Claude Code conversations will appear here automatically.
        </p>
      ) : (
        <div>
          {projects.map((p) => (
            <ProjectRow
              key={p.encodedDir}
              project={p}
              agents={agentsByDir.get(p.encodedDir) ?? []}
            />
          ))}
        </div>
      )}
    </main>
  );
}
