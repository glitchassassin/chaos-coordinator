import { Form, redirect } from "react-router";
import type { Route } from "./+types/agents.$id";
import {
  getAgent,
  sendInput,
  terminateAgent,
  updateLogPath,
  readScreen,
} from "../../server/agents.js";
import { getProject } from "../../server/projects.js";
import { findAgentLog, readLog } from "../../server/logs.js";
import { ConversationLog } from "~/components/ConversationLog";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Agent" }];
  return [{ title: `${data.project.name} — Agent` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const agent = getAgent(params.id!);
  if (!agent) throw new Response("Agent not found", { status: 404 });

  const project = getProject(agent.projectId);
  if (!project) throw new Response("Project not found", { status: 404 });

  const logPath = agent.logPath ?? findAgentLog(project.directory, agent.createdAt);
  const entries = logPath ? readLog(logPath) : [];

  // Persist the resolved path so future loads skip the scan
  if (logPath && !agent.logPath) {
    updateLogPath(agent.id, logPath);
  }

  let screen = "";
  try {
    screen = readScreen(agent.id);
  } catch {
    /* agent may be terminated */
  }

  return { agent, project, entries, screen };
}

export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "send") {
    const text = (form.get("text") as string | null)?.trim() ?? "";
    if (text) {
      try {
        sendInput(params.id!, text);
      } catch (err) {
        return { intent: "send" as const, error: (err as Error).message };
      }
    }
    return { intent: "send" as const, ok: true };
  }

  if (intent === "terminate") {
    terminateAgent(params.id!);
    return redirect("/");
  }

  return null;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: "#2e7d32",
  idle: "#555555",
  waiting: "#f57f17",
  starting: "#555555",
  terminated: "#c62828",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#555555";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        border: `2px solid ${color}`,
        color,
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AgentDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { agent, project, entries, screen } = loaderData;
  const sendError =
    actionData && "error" in actionData ? (actionData as { error: string }).error : undefined;
  const alive = agent.status !== "terminated";

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
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{project.name}</h1>
          <div
            className="font-mono"
            style={{ color: "#555555", fontSize: "0.875rem", wordBreak: "break-all" }}
          >
            {project.directory}
          </div>
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <StatusBadge status={agent.status} />
            <span style={{ color: "#555555", fontSize: "0.875rem" }}>
              Started {new Date(agent.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {alive && (
          <Form method="post" style={{ flexShrink: 0 }}>
            <input type="hidden" name="intent" value="terminate" />
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                border: "3px solid #c62828",
                background: "#c62828",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Terminate
            </button>
          </Form>
        )}
      </div>

      {/* Conversation log */}
      <section style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "1rem",
            marginBottom: "1rem",
            borderBottom: "1px solid #cccccc",
            paddingBottom: "0.5rem",
          }}
        >
          Conversation
        </h2>
        <ConversationLog initialEntries={entries} agentId={agent.id} />
      </section>

      {/* Terminal capture */}
      <section style={{ marginBottom: "2rem" }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, padding: "0.25rem 0" }}>
            Terminal
          </summary>
          <pre
            style={{
              border: "1px solid #cccccc",
              padding: "0.75rem",
              fontSize: "0.8125rem",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowY: "auto",
              maxHeight: 400,
              marginTop: "0.5rem",
            }}
          >
            {screen || "(no output)"}
          </pre>
        </details>
      </section>

      {/* Send input */}
      {alive && (
        <section>
          <h2
            style={{
              fontSize: "1rem",
              marginBottom: "1rem",
              borderBottom: "1px solid #cccccc",
              paddingBottom: "0.5rem",
            }}
          >
            Send Message
          </h2>
          <Form method="post">
            <input type="hidden" name="intent" value="send" />
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <textarea
                name="text"
                rows={3}
                placeholder="Type a message…"
                style={{
                  flex: 1,
                  padding: "0.5rem 0.75rem",
                  border: "3px solid #888888",
                  background: "none",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: "1rem",
                  resize: "vertical",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1rem",
                  border: "3px solid #888888",
                  background: "none",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                  minHeight: 44,
                }}
              >
                Send
              </button>
            </div>
            {sendError && (
              <p
                role="alert"
                style={{ color: "#c62828", marginTop: "0.25rem", fontSize: "0.875rem" }}
              >
                {sendError}
              </p>
            )}
          </Form>
        </section>
      )}
    </main>
  );
}
