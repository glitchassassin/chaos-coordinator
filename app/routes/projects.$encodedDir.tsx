import { useEffect, useMemo } from "react";
import { Form, redirect, useRevalidator } from "react-router";
import type { Route } from "./+types/projects.$encodedDir";
import { useDoubleCheck } from "~/utils/misc";
import { getProject } from "../../server/projects.js";
import { listAgents, launchAgent, terminateAgent, type RunningAgent } from "../../server/agents.js";
import { listConversations, type ConversationMeta } from "../../server/logs.js";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData.project.name} — Chaos Coordinator` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const project = getProject(params.encodedDir);
  if (!project) throw new Response("Project not found", { status: 404 });

  const agents = listAgents(project.encodedDir);
  const conversations = listConversations(project.encodedDir);

  return { project, agents, conversations };
}

export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "launch") {
    const project = getProject(params.encodedDir);
    if (!project) throw new Response("Project not found", { status: 404 });

    const initialPrompt = (form.get("initialPrompt") as string | null)?.trim() ?? undefined;
    try {
      launchAgent(project.encodedDir, project.directory, initialPrompt);
      return redirect(`/projects/${project.encodedDir}`);
    } catch (err) {
      return { intent: "launch" as const, error: (err as Error).message };
    }
  }

  if (intent === "terminate") {
    const agentId = form.get("id") as string;
    terminateAgent(agentId);
    return { intent: "terminate" as const, ok: true as const };
  }

  return null;
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

// ── Agent row ──────────────────────────────────────────────────────────────────

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function AgentRow({ agent, encodedDir }: { agent: RunningAgent; encodedDir: string }) {
  const dc = useDoubleCheck();
  const age = useMemo(() => formatAge(agent.createdAt), [agent.createdAt]);
  const href = agent.claudeSessionId
    ? `/projects/${encodedDir}/conversations/${agent.claudeSessionId}`
    : null;

  const content = (
    <>
      <StatusBadge status={agent.status} />
      <span style={{ color: "#555555" }}>{age} ago</span>
      {agent.initialPrompt && (
        <span
          style={{
            color: "#555555",
            fontSize: "0.8125rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 300,
          }}
        >
          {agent.initialPrompt}
        </span>
      )}
    </>
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.375rem 0",
    fontSize: "0.875rem",
    flexWrap: "wrap",
  };

  return (
    <div style={rowStyle}>
      {href ? (
        <a
          href={href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: 1,
            minWidth: 0,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          {content}
        </a>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
          {content}
        </div>
      )}
      <Form
        method="post"
        style={{ display: "inline", marginLeft: "auto", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="intent" value="terminate" />
        <input type="hidden" name="id" value={agent.id} />
        <button
          type="submit"
          {...dc.getButtonProps()}
          style={{
            padding: "0.25rem 0.625rem",
            border: "2px solid #c62828",
            color: "#c62828",
            background: "none",
            cursor: "pointer",
            fontSize: "0.8125rem",
            minHeight: 32,
          }}
        >
          {dc.doubleCheck ? "Confirm?" : "Terminate"}
        </button>
      </Form>
    </div>
  );
}

// ── Launch agent form ──────────────────────────────────────────────────────────

function LaunchAgentForm({ launchError }: { launchError?: string }) {
  return (
    <Form method="post" style={{ marginTop: "0.5rem" }}>
      <input type="hidden" name="intent" value="launch" />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          name="initialPrompt"
          placeholder="Initial prompt (optional)"
          style={{
            flex: 1,
            minWidth: 160,
            padding: "0 0.625rem",
            border: "2px solid #888888",
            background: "none",
            fontSize: "0.875rem",
            height: 36,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0 0.875rem",
            border: "2px solid #2e7d32",
            color: "#2e7d32",
            background: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            height: 36,
          }}
        >
          + New Agent
        </button>
      </div>
      {launchError && (
        <p role="alert" style={{ color: "#c62828", margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
          {launchError}
        </p>
      )}
    </Form>
  );
}

// ── Conversation list ──────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  encodedDir,
}: {
  conv: ConversationMeta;
  encodedDir: string;
}) {
  const date = new Date(conv.mtime);
  return (
    <a
      href={`/projects/${encodedDir}/conversations/${conv.sessionId}`}
      style={{
        display: "block",
        padding: "0.5rem 0",
        textDecoration: "none",
        color: "inherit",
        borderBottom: "1px solid #cccccc",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
        <span className="font-mono" style={{ fontSize: "0.8125rem" }}>
          {conv.sessionId.slice(0, 8)}
        </span>
        <span style={{ color: "#555555", fontSize: "0.8125rem", marginLeft: "auto" }}>
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </span>
      </div>
    </a>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { project, agents, conversations } = loaderData;
  const revalidator = useRevalidator();

  // Poll for agent status updates while agents are running
  useEffect(() => {
    if (agents.length === 0) return;
    const id = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 3_000);
    return () => clearInterval(id);
  }, [agents.length, revalidator]);

  const launchError =
    actionData?.intent === "launch" && "error" in actionData ? actionData.error : undefined;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.5rem" }}>
        <a href="/" style={{ color: "#1565c0", fontSize: "0.875rem" }}>
          ← Projects
        </a>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ flexShrink: 0, width: 24, paddingTop: "0.2rem", color: "#555555" }}>
          {project.providerType && <ProviderIcon type={project.providerType} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{project.name}</h1>
          <div
            className="font-mono"
            style={{ color: "#555555", fontSize: "0.875rem", wordBreak: "break-all" }}
          >
            {project.directory}
          </div>
        </div>
      </div>

      {/* Running agents */}
      <section style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "1rem",
            marginBottom: "1rem",
            borderBottom: "1px solid #cccccc",
            paddingBottom: "0.5rem",
          }}
        >
          Running Agents
        </h2>
        {agents.length > 0 ? (
          <div style={{ marginBottom: "0.5rem" }}>
            {agents.map((a) => (
              <AgentRow key={a.id} agent={a} encodedDir={project.encodedDir} />
            ))}
          </div>
        ) : (
          <p style={{ color: "#555555", fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
            No agents running.
          </p>
        )}
        <LaunchAgentForm launchError={launchError} />
      </section>

      {/* Conversations */}
      <section>
        <h2
          style={{
            fontSize: "1rem",
            marginBottom: "1rem",
            borderBottom: "1px solid #cccccc",
            paddingBottom: "0.5rem",
          }}
        >
          Conversations
        </h2>
        {conversations.length > 0 ? (
          <div>
            {conversations.map((conv) => (
              <ConversationRow
                key={conv.sessionId}
                conv={conv}
                encodedDir={project.encodedDir}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: "#555555" }}>No conversations found.</p>
        )}
      </section>
    </main>
  );
}
