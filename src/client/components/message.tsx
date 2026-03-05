import { marked, hljs } from "../util/highlight.js";
import { useState } from "preact/hooks";
import type { Part, ToolPart } from "../types.js";

interface Props {
  role: string;
  parts: Part[];
  showRole?: boolean;
}

function ThinkingBlock({ text, i }: { text: string; i: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div key={i} class="thinking-block">
      <button
        class="thinking-toggle"
        onClick={() => setExpanded((e) => !e)}
      >
        <em>Thinking... ({expanded ? "collapse" : "expand"})</em>
      </button>
      {expanded && (
        <div class="thinking-content">
          {text}
          <hr class="thinking-hr" />
        </div>
      )}
    </div>
  );
}

function ToolPartView({ part, i }: { part: ToolPart; i: number }) {
  const [expanded, setExpanded] = useState(false);
  const { tool, state } = part;
  const status = state.status;
  const title = state.title || tool;
  const statusSuffix =
    status === "pending"
      ? " ..."
      : status === "running"
        ? " (running)"
        : status === "error"
          ? " (error)"
          : "";

  return (
    <div key={i} class="tool-block">
      <button class="tool-toggle" onClick={() => setExpanded((e) => !e)}>
        <em>
          {title}
          {statusSuffix} ({expanded ? "collapse" : "expand"})
        </em>
      </button>
      {expanded && (
        <div class="tool-content">
          {state.input && (
            <>
              <div class="tool-section-label">input</div>
              <pre class="language-json">
                <code
                  class="language-json"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(
                      JSON.stringify(state.input, null, 2),
                      { language: "json" },
                    ).value,
                  }}
                />
              </pre>
            </>
          )}
          {state.output && (
            <>
              <div class="tool-section-label">output</div>
              <pre class="language-markdown">
                <code
                  class="language-markdown"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(state.output, {
                      language: "markdown",
                    }).value,
                  }}
                />
              </pre>
            </>
          )}
          {state.error && (
            <>
              <div class="tool-section-label">error</div>
              <pre>
                <code>{state.error}</code>
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function renderPart(part: Part, i: number, role: string) {
  switch (part.type) {
    case "text":
      if (!part.text) return null;
      if (role === "assistant") {
        const html = marked.parse(part.text as string) as string;
        return (
          <div
            key={i}
            class="message-content message-content--markdown"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      return (
        <div key={i} class="message-content">
          {part.text}
        </div>
      );
    case "tool":
      return <ToolPartView part={part as ToolPart} i={i} />;
    case "reasoning":
      if (!("text" in part) || !part.text) return null;
      return <ThinkingBlock key={i} text={part.text as string} i={i} />;
    default:
      // Skip internal part types (step-start, step-finish, snapshot, etc.)
      return null;
  }
}

export function Message({ role, parts, showRole }: Props) {
  // Skip messages with no visible parts
  const hasVisible = parts.some(
    (p) => p.type === "text" || p.type === "tool" || p.type === "reasoning",
  );
  if (!hasVisible && parts.length > 0) return null;

  return (
    <article class={`message message--${role}`}>
      {showRole && <h3 class="message-role">{role}</h3>}
      {parts.map((p, i) => renderPart(p, i, role))}
    </article>
  );
}
