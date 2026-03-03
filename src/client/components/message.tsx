import type { Part, ToolPart } from "../types.js";

interface Props {
  role: string;
  parts: Part[];
  showRole?: boolean;
}

function renderToolPart(part: ToolPart, i: number) {
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

  return (
    <div key={i} class="message-content">
      <pre>
        <code>
          [{label}]
          {status === "completed" && "output" in state && state.output
            ? `\n${state.output.length > 500 ? state.output.slice(0, 500) + "..." : state.output}`
            : ""}
          {status === "error" && "error" in state ? `\n${state.error}` : ""}
        </code>
      </pre>
    </div>
  );
}

function renderPart(part: Part, i: number) {
  switch (part.type) {
    case "text":
      if (!part.text) return null;
      return (
        <div key={i} class="message-content">
          {part.text}
        </div>
      );
    case "tool":
      return renderToolPart(part as ToolPart, i);
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
      {parts.map(renderPart)}
    </article>
  );
}
