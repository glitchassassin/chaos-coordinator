import { eq, isNull } from "drizzle-orm";
import { type Db, getDb } from "../db/client.js";
import { agents, projects } from "../db/schema.js";
import * as tmux from "./tmux.js";

export type Agent = typeof agents.$inferSelect;
export type AgentStatus =
  | "starting"
  | "active"
  | "idle"
  | "waiting"
  | "terminated";

const SESSION_PREFIX = "orch-";

// In-memory poll state — tracks last capture per agent to detect changes.
interface PollState {
  lastCapture: string;
  lastChangeAt: number;
}
const pollState = new Map<string, PollState>();

function sessionName(agentId: string): string {
  return `${SESSION_PREFIX}${agentId}`;
}

/**
 * Launch a new Claude Code agent for the given project.
 * Creates a tmux session named `orch-{id}` running `claude` in the project directory.
 * Sends the optional initial prompt after launch.
 */
export function launchAgent(
  projectId: string,
  initialPrompt?: string,
  db: Db = getDb(),
): Agent {
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.removedAt) throw new Error(`Project has been removed: ${projectId}`);

  const id = crypto.randomUUID();
  const session = sessionName(id);

  tmux.createSession(session, project.directory, "claude");
  if (initialPrompt?.trim()) {
    tmux.sendInput(session, initialPrompt);
  }

  db.insert(agents)
    .values({
      id,
      projectId,
      tmuxSession: session,
      status: "starting",
      initialPrompt: initialPrompt ?? null,
    })
    .run();

  const inserted = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!inserted) throw new Error("Failed to create agent record");
  return inserted;
}

/**
 * Send text input to a running agent.
 * Multi-line text uses Alt+Enter between lines (Claude Code convention).
 */
export function sendInput(agentId: string, text: string, db: Db = getDb()): void {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  if (agent.status === "terminated") throw new Error(`Agent is terminated: ${agentId}`);
  tmux.sendInput(agent.tmuxSession, text);
}

/** Capture the current terminal screen for an agent. */
export function readScreen(agentId: string, db: Db = getDb()): string {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  return tmux.capturePane(agent.tmuxSession);
}

/**
 * Terminate an agent: send `/exit` then force-kill the tmux session.
 * Marks the agent as terminated in the database.
 */
export function terminateAgent(agentId: string, db: Db = getDb()): void {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) return;

  if (agent.status !== "terminated") {
    try {
      tmux.sendInput(agent.tmuxSession, "/exit");
    } catch {
      // best-effort graceful exit
    }
    tmux.killSession(agent.tmuxSession);
  }

  db.update(agents)
    .set({ status: "terminated", endedAt: new Date().toISOString() })
    .where(eq(agents.id, agentId))
    .run();
  pollState.delete(agentId);
}

/** List agents, optionally filtered by project. */
export function listAgents(projectId?: string, db: Db = getDb()): Agent[] {
  if (projectId) {
    return db
      .select()
      .from(agents)
      .where(eq(agents.projectId, projectId))
      .all();
  }
  return db.select().from(agents).all();
}

/** Get a single agent by ID. Returns undefined if not found. */
export function getAgent(id: string, db: Db = getDb()): Agent | undefined {
  return db.select().from(agents).where(eq(agents.id, id)).get();
}

/**
 * Reconcile agent records against live tmux sessions.
 * Called on server startup to re-adopt running sessions and mark
 * orphaned agents as terminated.
 */
export function reconcileAgents(db: Db = getDb()): void {
  const sessions = new Set(tmux.listSessions());
  const liveAgents = db
    .select()
    .from(agents)
    .where(isNull(agents.endedAt))
    .all();

  for (const agent of liveAgents) {
    if (!sessions.has(agent.tmuxSession)) {
      db.update(agents)
        .set({ status: "terminated", endedAt: new Date().toISOString() })
        .where(eq(agents.id, agent.id))
        .run();
    }
  }
}

/**
 * Infer agent status from tmux capture-pane output.
 * Detects patterns that indicate Claude Code is waiting for user input.
 */
export function inferStatus(
  capture: string,
): Exclude<AgentStatus, "starting" | "terminated" | "idle"> {
  const lastLines = capture.trimEnd().split("\n").slice(-5).join("\n");
  if (/\?\s*(y\/N|Y\/n|\(yes\/no\))/i.test(lastLines)) return "waiting";
  if (/do you want to/i.test(lastLines)) return "waiting";
  if (/\b(allow|deny|proceed)\b/i.test(lastLines)) return "waiting";
  if (/press enter/i.test(lastLines)) return "waiting";
  return "active";
}

const IDLE_THRESHOLD_MS = 30_000;

/**
 * Poll a single agent: update its status based on tmux capture-pane output.
 * Exported for testing; normally called by startPolling.
 */
export function pollAgent(agentId: string, db: Db = getDb()): void {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent || agent.status === "terminated") return;

  if (!tmux.sessionExists(agent.tmuxSession)) {
    db.update(agents)
      .set({ status: "terminated", endedAt: new Date().toISOString() })
      .where(eq(agents.id, agentId))
      .run();
    pollState.delete(agentId);
    return;
  }

  const capture = tmux.capturePane(agent.tmuxSession);
  const now = Date.now();
  const state = pollState.get(agentId);

  if (!state) {
    pollState.set(agentId, { lastCapture: capture, lastChangeAt: now });
    db.update(agents)
      .set({ status: inferStatus(capture) })
      .where(eq(agents.id, agentId))
      .run();
    return;
  }

  if (capture !== state.lastCapture) {
    state.lastCapture = capture;
    state.lastChangeAt = now;
    db.update(agents)
      .set({ status: inferStatus(capture) })
      .where(eq(agents.id, agentId))
      .run();
  } else if (now - state.lastChangeAt > IDLE_THRESHOLD_MS) {
    db.update(agents)
      .set({ status: "idle" })
      .where(eq(agents.id, agentId))
      .run();
  }
}

/**
 * Start polling all live agents every 2 seconds.
 * Returns a stop function. Call on server startup.
 */
export function startPolling(db: Db = getDb()): () => void {
  const timer = setInterval(() => {
    const liveAgents = db
      .select()
      .from(agents)
      .where(isNull(agents.endedAt))
      .all();
    for (const agent of liveAgents) {
      pollAgent(agent.id, db);
    }
  }, 2_000);
  return () => { clearInterval(timer); };
}
