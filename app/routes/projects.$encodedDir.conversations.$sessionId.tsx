import { useEffect, useRef } from "react";
import { Form, redirect, useRevalidator, useSubmit } from "react-router";
import type { Route } from "./+types/projects.$encodedDir.conversations.$sessionId";
import { useDoubleCheck } from "~/utils/misc";
import { getProject } from "../../server/projects.js";
import {
  listAgents,
  sendInput,
  respondToPrompt,
  terminateAgent,
  type PermissionPrompt as PermissionPromptType,
} from "../../server/agents.js";
import { readLog } from "../../server/logs.js";
import { ConversationLog } from "~/components/ConversationLog";
import path from "node:path";
import os from "node:os";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Conversation — ${loaderData.project.name}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const project = getProject(params.encodedDir);
  if (!project) throw new Response("Project not found", { status: 404 });

  const sessionId = params.sessionId;
  const logPath = path.join(
    os.homedir(),
    ".claude",
    "projects",
    params.encodedDir,
    `${sessionId}.jsonl`,
  );

  const entries = readLog(logPath);

  // Check if a running agent is associated with this session
  const agents = listAgents(project.encodedDir);
  const runningAgent = agents.find((a) => a.claudeSessionId === sessionId) ?? null;

  return {
    project,
    sessionId,
    entries,
    runningAgent: runningAgent
      ? {
          id: runningAgent.id,
          status: runningAgent.status,
          tmuxSession: runningAgent.tmuxSession,
          createdAt: runningAgent.createdAt,
          permissionPrompt: runningAgent.permissionPrompt,
        }
      : null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "send") {
    const agentId = form.get("agentId") as string;
    const text = (form.get("text") as string | null)?.trim() ?? "";
    if (text) {
      try {
        sendInput(agentId, text);
      } catch (err) {
        return { intent: "send" as const, error: (err as Error).message };
      }
    }
    return { intent: "send" as const, ok: true };
  }

  if (intent === "respond") {
    const agentId = form.get("agentId") as string;
    const key = form.get("key") as string;
    if (key) {
      try {
        respondToPrompt(agentId, key);
      } catch (err) {
        return { intent: "respond" as const, error: (err as Error).message };
      }
    }
    return { intent: "respond" as const, ok: true };
  }

  if (intent === "terminate") {
    const agentId = form.get("agentId") as string;
    terminateAgent(agentId);
    return redirect(`/projects/${params.encodedDir}`);
  }

  return null;
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

// ── Permission prompt ─────────────────────────────────────────────────────────

function PermissionPromptPanel({
  agentId,
  prompt,
}: {
  agentId: string;
  prompt: PermissionPromptType;
}) {
  const submit = useSubmit();

  function respond(key: string) {
    const formData = new FormData();
    formData.set("intent", "respond");
    formData.set("agentId", agentId);
    formData.set("key", key);
    submit(formData, { method: "post" });
  }

  return (
    <section
      style={{
        marginBottom: "1.5rem",
        border: "3px solid #f57f17",
        padding: "1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "#f57f17",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: "0.5rem",
        }}
      >
        Permission Required
      </div>
      {prompt.question && (
        <p style={{ marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
          {prompt.question}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {prompt.options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => respond(opt.key)}
            style={{
              padding: "0.375rem 0.75rem",
              border: "2px solid #888888",
              background: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              minHeight: 36,
            }}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => respond("Escape")}
          style={{
            padding: "0.375rem 0.75rem",
            border: "2px solid #c62828",
            color: "#c62828",
            background: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            minHeight: 36,
          }}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

// ── Send message form ────────────────────────────────────────────────────────

const MAX_ROWS = 5;

function SendMessageForm({ agentId, sendError }: { agentId: string; sendError?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submit = useSubmit();

  function computeRows() {
    const el = textareaRef.current;
    if (!el) return;
    el.rows = 1;
    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingBlock = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const lines = Math.round((el.scrollHeight - paddingBlock) / lineHeight);
    el.rows = Math.min(Math.max(lines, 1), MAX_ROWS);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const form = formRef.current;
    const textarea = textareaRef.current;
    if (!form || !textarea) return;
    submit(form);
    textarea.value = "";
    textarea.rows = 1;
  }

  return (
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
      <Form method="post" ref={formRef}>
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="agentId" value={agentId} />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            name="text"
            rows={1}
            aria-label="Message"
            placeholder="Type a message…"
            onKeyDown={handleKeyDown}
            onInput={computeRows}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              border: "3px solid #888888",
              background: "none",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "1rem",
              lineHeight: 1.5,
              resize: "none",
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
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConversationView({ loaderData, actionData }: Route.ComponentProps) {
  const { project, sessionId, entries, runningAgent } = loaderData;
  const sendError =
    actionData && "error" in actionData ? (actionData as { error: string }).error : undefined;
  const dc = useDoubleCheck();
  const revalidator = useRevalidator();

  // Poll every 3s while a running agent exists (for live status/prompt updates)
  useEffect(() => {
    if (!runningAgent) return;
    const id = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 3_000);
    return () => clearInterval(id);
  }, [runningAgent, revalidator]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        <a href="/" style={{ color: "#1565c0" }}>Projects</a>
        {" / "}
        <a href={`/projects/${project.encodedDir}`} style={{ color: "#1565c0" }}>
          {project.name}
        </a>
        {" / "}
        <span style={{ color: "#555555" }}>
          {sessionId.slice(0, 8)}
        </span>
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
          {runningAgent && (
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <StatusBadge status={runningAgent.status} />
              <span style={{ color: "#555555", fontSize: "0.875rem" }}>
                Started {new Date(runningAgent.createdAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {runningAgent && (
          <Form method="post" style={{ flexShrink: 0 }}>
            <input type="hidden" name="intent" value="terminate" />
            <input type="hidden" name="agentId" value={runningAgent.id} />
            <button
              type="submit"
              {...dc.getButtonProps()}
              style={{
                padding: "0.5rem 1rem",
                border: "3px solid #c62828",
                background: dc.doubleCheck ? "#c62828" : "none",
                color: dc.doubleCheck ? "#fff" : "#c62828",
                cursor: "pointer",
              }}
            >
              {dc.doubleCheck ? "Confirm?" : "Terminate"}
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
        <ConversationLog
          initialEntries={entries}
          sessionId={sessionId}
          encodedDir={project.encodedDir}
          agentId={runningAgent?.id}
        />
      </section>

      {/* Permission prompt */}
      {runningAgent?.permissionPrompt && (
        <PermissionPromptPanel
          agentId={runningAgent.id}
          prompt={runningAgent.permissionPrompt}
        />
      )}

      {/* Debug: tmux attach command */}
      {runningAgent && (
        <p style={{ fontSize: "0.75rem", color: "#888888", fontFamily: "monospace" }}>
          tmux attach -t {runningAgent.tmuxSession}
        </p>
      )}

      {/* Send input */}
      {runningAgent && (
        <SendMessageForm agentId={runningAgent.id} sendError={sendError} />
      )}
    </main>
  );
}
