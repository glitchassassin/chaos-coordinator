import { marked, type Tokens } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import diff from "highlight.js/lib/languages/diff";
import { useState } from "preact/hooks";
import type { Part, ToolPart } from "../types.js";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("diff", diff);

marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const language = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs language-${language ?? "plaintext"}">${highlighted}</code></pre>`;
    },
  },
});

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
