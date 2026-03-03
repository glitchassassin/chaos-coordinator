import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: unknown;
}

export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | ToolResultBlock;

export interface LogEntry {
  type: "user" | "assistant";
  uuid?: string;
  timestamp?: string;
  message: {
    role: "user" | "assistant";
    content: ContentBlock[];
  };
}

// ── Path encoding ──────────────────────────────────────────────────────────────

/**
 * Encode a project directory path to Claude Code's storage format.
 * /Users/foo/bar → -Users-foo-bar  (each "/" becomes "-")
 */
export function encodeDirectory(directory: string): string {
  return directory.replaceAll("/", "-");
}

// ── Log file discovery ─────────────────────────────────────────────────────────

/**
 * Find the Claude Code log directory for a project directory.
 * Returns null if not found.
 */
export function findLogDir(directory: string): string | null {
  const encoded = encodeDirectory(directory);
  const logDir = path.join(os.homedir(), ".claude", "projects", encoded);
  return fs.existsSync(logDir) ? logDir : null;
}

/**
 * List all JSONL files in a log directory, sorted newest-first by mtime.
 */
export function listLogFiles(logDir: string): string[] {
  try {
    return fs
      .readdirSync(logDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => path.join(logDir, f))
      .sort((a, b) => {
        try {
          return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        } catch {
          return 0;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Find the log file most likely associated with an agent by its creation time.
 * Looks for JSONL files created within a tolerance window after agentCreatedAt.
 * Falls back to the most recently modified file if no good match.
 */
export function findAgentLog(
  directory: string,
  agentCreatedAt: string,
): string | null {
  const logDir = findLogDir(directory);
  if (!logDir) return null;
  const files = listLogFiles(logDir);
  if (files.length === 0) return null;

  const createdMs = new Date(agentCreatedAt).getTime();
  const TOLERANCE_MS = 30_000; // 30s window to account for Claude startup time

  // Files created at or after the agent start, sorted oldest-first
  const candidates = files
    .filter((f) => {
      try {
        const { birthtimeMs } = fs.statSync(f);
        return birthtimeMs >= createdMs - TOLERANCE_MS;
      } catch {
        return false;
      }
    })
    .reverse(); // oldest first → first created after agent start

  return candidates[0] ?? files[0]; // fallback to newest
}

// ── Conversation discovery ────────────────────────────────────────────────────

export interface ConversationMeta {
  sessionId: string;
  path: string;
  mtime: number;
}

/**
 * Read the `cwd` field from the first entry in a JSONL file that has one.
 * Fast — reads line-by-line and stops at the first match.
 */
export function readCwd(logPath: string): string | null {
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof raw.cwd === "string" && raw.cwd) return raw.cwd;
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file not found or unreadable
  }
  return null;
}

/**
 * List all conversations (JSONL files) for a project's encoded directory.
 * Returns structured metadata sorted newest-first by mtime.
 * Skips subagents/ subdirectories.
 */
export function listConversations(encodedDir: string): ConversationMeta[] {
  const logDir = path.join(os.homedir(), ".claude", "projects", encodedDir);
  try {
    const entries = fs.readdirSync(logDir, { withFileTypes: true });
    const results: ConversationMeta[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const filePath = path.join(logDir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        results.push({
          sessionId: entry.name.replace(/\.jsonl$/, ""),
          path: filePath,
          mtime: stat.mtimeMs,
        });
      } catch {
        // skip unreadable files
      }
    }
    return results.sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

// ── JSONL parsing ──────────────────────────────────────────────────────────────

function normalizeContent(raw: unknown): ContentBlock[] {
  if (typeof raw === "string") {
    return [{ type: "text", text: raw }];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is ContentBlock =>
      typeof b === "object" && b !== null && typeof (b as ContentBlock).type === "string",
  );
}

/**
 * Parse a JSONL log file into LogEntry[].
 * Skips non-conversation entries (file-history-snapshot, queue-operation, etc.).
 */
export function readLog(logPath: string): LogEntry[] {
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const entries: LogEntry[] = [];

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as Record<string, unknown>;
        if (raw.type !== "user" && raw.type !== "assistant") continue;
        const msg = raw.message as { role?: string; content?: unknown } | undefined;
        if (!msg?.role) continue;

        entries.push({
          type: raw.type,
          uuid: raw.uuid as string | undefined,
          timestamp: raw.timestamp as string | undefined,
          message: {
            role: msg.role as "user" | "assistant",
            content: normalizeContent(msg.content),
          },
        });
      } catch {
        // skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// ── File watching ──────────────────────────────────────────────────────────────

/**
 * Watch a log file for changes and call callback with updated entries.
 * Debounced by 1s. Returns an unwatch function.
 */
export function watchLog(
  logPath: string,
  callback: (entries: LogEntry[]) => void,
): () => void {
  let debounce: ReturnType<typeof setTimeout> | null = null;

  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(logPath, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        callback(readLog(logPath));
      }, 1000);
    });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  return () => {
    if (debounce) clearTimeout(debounce);
    try {
      watcher.close();
    } catch {
      /* ignore */
    }
  };
}
