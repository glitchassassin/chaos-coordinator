import path from "node:path";
import os from "node:os";
import * as tmux from "./tmux.js";
import { encodeDirectory } from "./logs.js";

export interface PromptOption {
  key: string;   // "1", "2", "3", "y", "n", etc.
  label: string; // "Yes", "No", etc.
}

export interface PermissionPrompt {
  question: string;
  options: PromptOption[];
}

export interface RunningAgent {
  id: string;
  encodedDir: string;
  directory: string;
  tmuxSession: string;
  status: "starting" | "active" | "idle" | "waiting";
  initialPrompt: string | null;
  claudeSessionId: string | null;
  logPath: string | null;
  createdAt: string;
  permissionPrompt: PermissionPrompt | null;
}

export type AgentStatus = RunningAgent["status"] | "terminated";

const SESSION_PREFIX = "orch-";

// ── In-memory stores ────────────────────────────────────────────────────────

/** All running agents, keyed by agent ID. */
const agents = new Map<string, RunningAgent>();

/** Per-agent poll state for idle detection. */
interface PollState {
  lastCapture: string;
  lastChangeAt: number;
}
const pollState = new Map<string, PollState>();

/** Tracks agents whose initial prompt has been sent (after Claude is ready). */
const initialPromptSent = new Set<string>();

function sessionName(agentId: string): string {
  return `${SESSION_PREFIX}${agentId}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Launch a new Claude Code agent for a project directory.
 * Creates a tmux session named `orch-{id}` running `claude`.
 */
export function launchAgent(
  encodedDir: string,
  directory: string,
  initialPrompt?: string,
): RunningAgent {
  const id = crypto.randomUUID();
  const session = sessionName(id);

  tmux.createSession(session, directory, "claude");

  const agent: RunningAgent = {
    id,
    encodedDir,
    directory,
    tmuxSession: session,
    status: "starting",
    initialPrompt: initialPrompt ?? null,
    claudeSessionId: null,
    logPath: null,
    createdAt: new Date().toISOString(),
    permissionPrompt: null,
  };

  agents.set(id, agent);
  return agent;
}

/**
 * Send text input to a running agent.
 */
export function sendInput(agentId: string, text: string): void {
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  tmux.sendInput(agent.tmuxSession, text);
}

/**
 * Respond to a permission prompt by sending a single keystroke.
 * Used for numbered-option prompts (sends "1", "2", etc.) and Escape to cancel.
 */
export function respondToPrompt(agentId: string, key: string): void {
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  tmux.pressKey(agent.tmuxSession, key);
}

/** Capture the current terminal screen for an agent. */
export function readScreen(agentId: string): string {
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  return tmux.capturePane(agent.tmuxSession);
}

/**
 * Terminate an agent: send `/exit` then force-kill the tmux session.
 * Removes the agent from the in-memory store.
 */
export function terminateAgent(agentId: string): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  try {
    tmux.sendInput(agent.tmuxSession, "/exit");
  } catch {
    // best-effort graceful exit
  }
  tmux.killSession(agent.tmuxSession);

  agents.delete(agentId);
  pollState.delete(agentId);
  initialPromptSent.delete(agentId);
}

/** List running agents, optionally filtered by encoded directory. */
export function listAgents(encodedDir?: string): RunningAgent[] {
  const all = Array.from(agents.values());
  if (encodedDir) return all.filter((a) => a.encodedDir === encodedDir);
  return all;
}

/** Get a single running agent by ID. */
export function getAgent(id: string): RunningAgent | undefined {
  return agents.get(id);
}

/**
 * Reconcile running agents against live tmux sessions.
 * Called on server startup to re-adopt running `orch-*` sessions.
 */
export function reconcileAgents(): void {
  const sessions = tmux.listSessions();
  const orchSessions = sessions.filter((s) => s.startsWith(SESSION_PREFIX));

  // Remove agents whose sessions no longer exist
  for (const [id, agent] of agents) {
    if (!sessions.includes(agent.tmuxSession)) {
      agents.delete(id);
      pollState.delete(id);
    }
  }

  // Adopt orphan orch-* sessions not already tracked
  const tracked = new Set(Array.from(agents.values()).map((a) => a.tmuxSession));
  for (const session of orchSessions) {
    if (tracked.has(session)) continue;
    const id = session.slice(SESSION_PREFIX.length);
    const directory = tmux.paneCwd(session);
    const encodedDir = directory ? encodeDirectory(directory) : "";
    agents.set(id, {
      id,
      encodedDir,
      directory,
      tmuxSession: session,
      status: "active",
      initialPrompt: null,
      claudeSessionId: null,
      logPath: null,
      createdAt: new Date().toISOString(),
      permissionPrompt: null,
    });
  }
}

/**
 * Parse a numbered-option permission prompt from tmux capture-pane output.
 *
 * Claude Code renders prompts like:
 *   Do you want to create test.txt?
 *   ❯ 1. Yes
 *     2. Yes, allow all edits during this session (shift+tab)
 *     3. No
 *
 * Returns null if no recognizable prompt is found.
 */
export function parsePermissionPrompt(capture: string): PermissionPrompt | null {
  const lines = capture.trimEnd().split("\n");
  // Scan from the bottom for numbered options (they cluster at the end)
  const optionRe = /^\s*[❯►▸> ]\s*(\d+)\.\s+(.+)$/;
  const options: PromptOption[] = [];
  let firstOptionIdx = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const m = optionRe.exec(lines[i]);
    if (m) {
      options.unshift({ key: m[1], label: m[2].trim() });
      firstOptionIdx = i;
    } else if (options.length > 0) {
      // We've moved past the option block
      break;
    }
  }

  if (options.length === 0) return null;

  // The question is the non-empty line(s) immediately above the first option
  let question = "";
  for (let i = firstOptionIdx - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed) break;
    // Stop if we hit a decorative line (─, ╌, ═, etc.)
    if (/^[─╌═┄┈╍╌━]+$/.test(trimmed)) break;
    question = trimmed + (question ? " " + question : "");
  }

  return { question, options };
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
const SESSION_RE = /\bsession:\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/;

/**
 * Extract the Claude session ID from tmux capture-pane output.
 * Claude Code displays `session: {uuid}` in its status line.
 */
export function parseSessionId(capture: string): string | null {
  const match = SESSION_RE.exec(capture);
  return match?.[1] ?? null;
}

/**
 * Poll a single agent: update its status based on tmux capture-pane output.
 */
export function pollAgent(agentId: string): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  if (!tmux.sessionExists(agent.tmuxSession)) {
    console.log(`[agent ${agentId.slice(0, 8)}] session gone — removing`);
    agents.delete(agentId);
    pollState.delete(agentId);
    initialPromptSent.delete(agentId);
    return;
  }

  const capture = tmux.capturePane(agent.tmuxSession);
  const now = Date.now();
  const prev = agent.status;
  const state = pollState.get(agentId);

  if (!state) {
    pollState.set(agentId, { lastCapture: capture, lastChangeAt: now });
    agent.status = inferStatus(capture);
  } else if (capture !== state.lastCapture) {
    state.lastCapture = capture;
    state.lastChangeAt = now;
    agent.status = inferStatus(capture);
  } else if (now - state.lastChangeAt > IDLE_THRESHOLD_MS) {
    // If capture looks like a prompt, stay "waiting" — don't override with "idle"
    const inferred = inferStatus(capture);
    agent.status = inferred === "waiting" ? "waiting" : "idle";
  }

  // Parse permission prompt when waiting, clear when not
  agent.permissionPrompt =
    agent.status === "waiting" ? parsePermissionPrompt(capture) : null;

  if (agent.status !== prev) {
    console.log(`[agent ${agentId.slice(0, 8)}] ${prev} → ${agent.status}`);
  }

  // Backfill directory/encodedDir if not yet known (e.g. reconciled agents)
  if (!agent.directory) {
    const cwd = tmux.paneCwd(agent.tmuxSession);
    if (cwd) {
      agent.directory = cwd;
      agent.encodedDir = encodeDirectory(cwd);
    }
  }

  // Discover the Claude session ID from the terminal output
  if (!agent.claudeSessionId) {
    const sessionId = parseSessionId(capture);
    if (sessionId) {
      agent.claudeSessionId = sessionId;
      if (agent.encodedDir) {
        agent.logPath = path.join(
          os.homedir(), ".claude", "projects", agent.encodedDir, `${sessionId}.jsonl`,
        );
      }
      console.log(`[agent ${agentId.slice(0, 8)}] linked to session ${sessionId.slice(0, 8)}`);

      // Send deferred initial prompt now that Claude is ready
      if (agent.initialPrompt && !initialPromptSent.has(agentId)) {
        initialPromptSent.add(agentId);
        tmux.sendInput(agent.tmuxSession, agent.initialPrompt);
        console.log(`[agent ${agentId.slice(0, 8)}] sent initial prompt`);
      }
    }
  }
}

/**
 * Start polling all running agents every 2 seconds.
 * Returns a stop function.
 */
export function startPolling(): () => void {
  const timer = setInterval(() => {
    for (const id of agents.keys()) {
      pollAgent(id);
    }
  }, 2_000);
  return () => {
    clearInterval(timer);
  };
}

/** Clear all agents from in-memory store (for testing). */
export function _clearAgents(): void {
  agents.clear();
  pollState.clear();
  initialPromptSent.clear();
}

// ── Auto-start ────────────────────────────────────────────────────────────────
// Runs once when the module is first imported (works in both `react-router dev`
// and the production Hono server). Skipped during Vitest runs.

if (process.env.NODE_ENV !== "test") {
  reconcileAgents();
  startPolling();
  console.log("[agents] polling started");
}
