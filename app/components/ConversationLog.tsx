import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import type { LogEntry, ToolUseBlock as TToolUse, ThinkingBlock as TThinking } from "../../server/logs.js";

marked.use({ breaks: true });

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

/** Build map of tool_use_id → result content from all tool_result blocks. */
function buildResultMap(entries: LogEntry[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const entry of entries) {
    if (entry.type !== "user") continue;
    for (const block of entry.message.content) {
      if (block.type === "tool_result") {
        map.set(block.tool_use_id, block.content);
      }
    }
  }
  return map;
}

/** True if a user entry consists entirely of tool_result blocks (show inline, not as separate message). */
function isToolResultOnly(entry: LogEntry): boolean {
  return (
    entry.type === "user" &&
    entry.message.content.length > 0 &&
    entry.message.content.every((b) => b.type === "tool_result")
  );
}

// ── Block renderers ────────────────────────────────────────────────────────────

function TextBlockView({ text }: { text: string }) {
  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

function ThinkingBlockView({ block }: { block: TThinking }) {
  return (
    <details style={{ marginBottom: "0.5rem" }}>
      <summary
        style={{ color: "#777777", cursor: "pointer", userSelect: "none", fontSize: "0.875rem" }}
      >
        Thinking…
      </summary>
      <pre
        style={{
          color: "#777777",
          fontSize: "0.8125rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: "0.5rem 0 0",
          padding: "0.5rem",
          border: "1px solid #cccccc",
        }}
      >
        {block.thinking}
      </pre>
    </details>
  );
}

function resultText(result: unknown): string {
  if (typeof result === "string") {
    const s = result.slice(0, 3000);
    return result.length > 3000 ? s + "\n…(truncated)" : s;
  }
  const s = JSON.stringify(result, null, 2);
  return s.length > 3000 ? s.slice(0, 3000) + "\n…(truncated)" : s;
}

function ToolUseBlockView({ block, result }: { block: TToolUse; result: unknown }) {
  return (
    <details style={{ marginBottom: "0.5rem" }}>
      <summary
        style={{
          cursor: "pointer",
          userSelect: "none",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          padding: "0.125rem 0",
        }}
      >
        <span style={{ fontWeight: 600 }}>{block.name}</span>
      </summary>
      <div
        style={{
          border: "1px solid #cccccc",
          padding: "0.5rem",
          fontSize: "0.8125rem",
          fontFamily: "monospace",
          marginTop: "0.25rem",
        }}
      >
        <div style={{ color: "#555555", marginBottom: "0.25rem" }}>Input</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(block.input, null, 2)}
        </pre>
        {result !== undefined && (
          <>
            <div style={{ color: "#555555", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
              Result
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {resultText(result)}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}

// ── Entry renderers ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "#555555",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: "0.375rem",
};

function UserEntry({ entry }: { entry: LogEntry }) {
  const textBlocks = entry.message.content.filter(
    (b): b is { type: "text"; text: string } => b.type === "text",
  );
  if (textBlocks.length === 0) return null;
  return (
    <div
      style={{
        borderLeft: "3px solid #1565c0",
        paddingLeft: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={labelStyle}>User</div>
      {textBlocks.map((b, i) => (
        <TextBlockView key={i} text={b.text} />
      ))}
    </div>
  );
}

function AssistantEntry({
  entry,
  resultMap,
}: {
  entry: LogEntry;
  resultMap: Map<string, unknown>;
}) {
  return (
    <div
      style={{
        borderLeft: "3px solid #cccccc",
        paddingLeft: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={labelStyle}>Claude</div>
      {entry.message.content.map((block, i) => {
        if (block.type === "text") return <TextBlockView key={i} text={block.text} />;
        if (block.type === "thinking") return <ThinkingBlockView key={i} block={block} />;
        if (block.type === "tool_use")
          return <ToolUseBlockView key={i} block={block} result={resultMap.get(block.id)} />;
        return null;
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ConversationLogProps {
  initialEntries: LogEntry[];
  agentId: string;
}

export function ConversationLog({ initialEntries, agentId }: ConversationLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>(initialEntries);
  const bottomRef = useRef<HTMLDivElement>(null);

  // WebSocket live updates
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?agentId=${agentId}`);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          entries?: LogEntry[];
        };
        if (msg.type === "entries" && Array.isArray(msg.entries)) {
          setEntries(msg.entries);
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, [agentId]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [entries.length]);

  const resultMap = buildResultMap(entries);
  const visible = entries.filter((e) => !isToolResultOnly(e));

  if (visible.length === 0) {
    return (
      <p style={{ color: "#555555" }}>
        No conversation log yet — the agent may still be starting up.
      </p>
    );
  }

  return (
    <div>
      {visible.map((entry, i) =>
        entry.type === "user" ? (
          <UserEntry key={entry.uuid ?? i} entry={entry} />
        ) : (
          <AssistantEntry key={entry.uuid ?? i} entry={entry} resultMap={resultMap} />
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}
