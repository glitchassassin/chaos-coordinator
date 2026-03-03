import { execFileSync } from "child_process";

/**
 * Low-level tmux utilities.
 * Uses execFileSync with array args to avoid shell injection.
 */

/** Create a new detached tmux session running the given command in cwd. */
export function createSession(name: string, cwd: string, command?: string): void {
  const args = ["new-session", "-d", "-s", name, "-c", cwd];
  if (command) args.push(command);
  execFileSync("tmux", args, { timeout: 10_000 });
}

/** Send literal text to a tmux pane (no key-name interpretation). */
export function sendText(session: string, text: string): void {
  execFileSync("tmux", ["send-keys", "-t", session, "-l", text], {
    timeout: 5_000,
  });
}

/** Press a named key (e.g. "Enter", "M-Enter") in a tmux pane. */
export function pressKey(session: string, key: string): void {
  execFileSync("tmux", ["send-keys", "-t", session, key], { timeout: 5_000 });
}

/**
 * Type text into a tmux pane and submit with Enter.
 * Multi-line input uses M-Enter (Alt+Enter) between lines, matching
 * Claude Code's multi-line input behaviour.
 */
export function sendInput(session: string, text: string): void {
  const lines = text.split("\n");
  sendText(session, lines[0]);
  for (let i = 1; i < lines.length; i++) {
    pressKey(session, "M-Enter");
    sendText(session, lines[i]);
  }
  pressKey(session, "Enter");
}

/** Capture the visible pane contents. Returns empty string if the session is gone. */
export function capturePane(session: string): string {
  try {
    return execFileSync("tmux", ["capture-pane", "-p", "-t", session], {
      encoding: "utf8",
      timeout: 5_000,
    });
  } catch {
    return "";
  }
}

/** Kill a tmux session. No-op if the session does not exist. */
export function killSession(session: string): void {
  try {
    execFileSync("tmux", ["kill-session", "-t", session], {
      timeout: 5_000,
    });
  } catch {
    // session may already be gone
  }
}

/** Return all current tmux session names. Returns [] if tmux has no sessions or is unavailable. */
export function listSessions(): string[] {
  try {
    const out = execFileSync(
      "tmux",
      ["list-sessions", "-F", "#{session_name}"],
      { encoding: "utf8", timeout: 5_000 },
    );
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Return the current working directory of a tmux pane. Returns empty string on failure. */
export function paneCwd(session: string): string {
  try {
    return execFileSync(
      "tmux",
      ["display-message", "-p", "-t", session, "#{pane_current_path}"],
      { encoding: "utf8", timeout: 5_000 },
    ).trim();
  } catch {
    return "";
  }
}

/** Return true if the named tmux session currently exists. */
export function sessionExists(session: string): boolean {
  try {
    execFileSync("tmux", ["has-session", "-t", session], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
