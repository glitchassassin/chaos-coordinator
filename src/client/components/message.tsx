import { marked } from "../util/highlight.js";
import { useState } from "preact/hooks";
import type { Part, ToolPart } from "../types.js";

interface Props {
  role: string;
  parts: Part[];
  showRole?: boolean;
}

function ToolPartView({ part, i }: { part: ToolPart; i: number }) {
  const [expanded, setExpanded] = useState(false);
  const { tool, state } = part;
  const status = state.status;
  const title = ("title" in state && state.title) || tool;
  const label =
    status === "pending"
      ? `${title} ...`
      : status === "running"
        ? `${title} (running)`
        : status === "error"
          ? `${title} (error)`
          : title;

  const output =
    status === "completed" && "output" in state && state.output
      ? state.output
      : null;
  const truncatable = output !== null && output.length > 500;
  const displayOutput = output
    ? `\n${!expanded && truncatable ? output.slice(0, 500) + "..." : output}`
    : "";

  return (
    <div key={i} class="message-content">
      <div class="tool-output-wrapper">
        {truncatable && (
          <button
            class="tool-output-toggle"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
        <pre>
          <code>
            [{label}]
            {displayOutput}
            {status === "error" && "error" in state ? `\n${state.error}` : ""}
          </code>
        </pre>
      </div>
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
      return (
        <div key={i} class="message-content" style={{ fontStyle: "italic" }}>
          {part.text as string}
        </div>
      );
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
