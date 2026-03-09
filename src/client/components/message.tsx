import { marked, highlight } from "../util/highlight.js";
import { useState } from "preact/hooks";
import type { ApiError, MessageInfo, Part, ToolPart } from "../types.js";
import { DiffView } from "./diff-view.js";

interface Props {
  role: string;
  parts: Part[];
  info?: MessageInfo;
  showRole?: boolean;
}

function ExpandIcon() {
  return (
    // mdi:arrow-expand-vertical
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13,9V15H16L12,19L8,15H11V9H8L12,5L16,9H13M4,2H20V4H4V2M4,20H20V22H4V20Z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    // mdi:arrow-collapse-vertical
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4,12H20V14H4V12M4,9H20V11H4V9M16,4L12,8L8,4H11V1H13V4H16M8,19L12,15L16,19H13V22H11V19H8Z" />
    </svg>
  );
}

function ThinkingBlock({ text, i }: { text: string; i: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div key={i} class="thinking-block">
      <button
        class="thinking-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? <CollapseIcon /> : <ExpandIcon />}
      </button>
      <em>Thinking...</em>
      {expanded && (
        <div class="thinking-content">
          {text}
        </div>
      )}
    </div>
  );
}

function BashToolView({ part, i }: { part: ToolPart; i: number }) {
  const [expanded, setExpanded] = useState(false);
  const { state } = part;
  const command = (state.input?.command as string) || "";
  const isRunning = state.status === "running" || state.status === "pending";
  const outputLines = state.output ? state.output.split("\n") : [];
  const collapsedOutput = outputLines.slice(0, 3).join("\n");
  const errorLines = state.error ? state.error.split("\n") : [];
  const errorFirstLine = errorLines[0] ?? "";
  const errorCollapsed = errorLines.length > 1 ? errorFirstLine + "…" : errorFirstLine;
  const isTruncated = outputLines.length > 3 || errorLines.length > 1;

  return (
    <div key={i} class="bash-tool">
      {!isRunning && isTruncated && (
        <button
          class="bash-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      )}
      <pre class="bash-tool-pre">
        <span class="bash-cmd-line">
          <span class="bash-prompt">&gt; </span>
          <code
            class="language-bash"
            dangerouslySetInnerHTML={{ __html: highlight(command, "bash") }}
          />
          {isRunning && <span class="bash-running"> ...</span>}
        </span>
        {expanded ? (
          <>
            {state.output}
            {state.error && (
              <em class="bash-error">{"\n" + state.error}</em>
            )}
          </>
        ) : (
          <>
            {collapsedOutput}
            {state.error && <em class="bash-error">{"\n" + errorCollapsed}</em>}
          </>
        )}
      </pre>
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

  const filepath =
    typeof state.metadata?.filepath === "string"
      ? state.metadata.filepath
      : (state.input?.filePath as string) || undefined;

  // Use metadata diff if available; for write tools, synthesize an all-additions diff from content
  let diff =
    typeof state.metadata?.diff === "string" ? state.metadata.diff : null;
  if (!diff && tool === "write" && typeof state.input?.content === "string") {
    const lines = (state.input.content as string).split("\n");
    diff = `@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n");
  }

  return (
    <div key={i} class="tool-block">
      <button
        class="tool-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? <CollapseIcon /> : <ExpandIcon />}
      </button>
      <em>{title !== tool ? `${tool}: ${title}` : tool}{statusSuffix}</em>
      {expanded && (
        <div class="tool-content">
          {diff ? (
            <DiffView diff={diff} filepath={filepath} defaultExpanded={true} />
          ) : (
            <>
              {state.input && (
                <>
                  <div class="tool-section-label">input</div>
                  <pre class="language-json">
                    <code
                      class="language-json"
                      dangerouslySetInnerHTML={{
                        __html: highlight(
                          JSON.stringify(state.input, null, 2),
                          "json",
                        ),
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
                        __html: highlight(state.output, "markdown"),
                      }}
                    />
                  </pre>
                </>
              )}
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

export function ApiErrorView({ error }: { error: ApiError }) {
  const [expanded, setExpanded] = useState(false);
  const message = (error.data?.message as string) || error.name;
  const msgLines = message.split("\n");
  const collapsedMsg = msgLines.length > 3 ? msgLines.slice(0, 3).join("\n") + "…" : message;
  const isTruncated = msgLines.length > 3;

  return (
    <div class="api-error">
      {isTruncated && (
        <button
          class="api-error-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      )}
      <pre class="api-error-pre">
        <span class="api-error-name">error: {error.name}</span>
        {"\n"}
        <em>{expanded ? message : collapsedMsg}</em>
      </pre>
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
    case "tool": {
      const tp = part as ToolPart;
      if (tp.tool === "bash") return <BashToolView part={tp} i={i} />;
      return <ToolPartView part={tp} i={i} />;
    }
    case "reasoning":
      if (!("text" in part) || !part.text) return null;
      return <ThinkingBlock key={i} text={part.text as string} i={i} />;
    default:
      // Skip internal part types (step-start, step-finish, snapshot, etc.)
      return null;
  }
}

export function Message({ role, parts, info, showRole }: Props) {
  const msgError = info?.error as ApiError | undefined;
  // Skip messages with no visible parts and no error
  const hasVisible = parts.some(
    (p) => p.type === "text" || p.type === "tool" || p.type === "reasoning",
  );
  if (!hasVisible && parts.length > 0 && !msgError) return null;

  return (
    <article class={`message message--${role}`}>
      {showRole && (
        <h3 class="message-role">
          {role}
          {role === "assistant" && info?.modelID && (
            <span> ({info.modelID})</span>
          )}
        </h3>
      )}
      {parts.map((p, i) => renderPart(p, i, role))}
      {msgError && <ApiErrorView error={msgError} />}
    </article>
  );
}
