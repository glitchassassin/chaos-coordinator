import { useState, useMemo } from "preact/hooks";
import { extensionToLanguage } from "../util/highlight.js";
import { parsePatch, highlightLines, INDICATOR } from "../util/diff.js";

interface DiffViewProps {
  diff: string;
  filepath?: string;
  defaultExpanded?: boolean;
}

function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13,9V15H16L12,19L8,15H11V9H8L12,5L16,9H13M4,2H20V4H4V2M4,20H20V22H4V20Z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4,12H20V14H4V12M4,9H20V11H4V9M16,4L12,8L8,4H11V1H13V4H16M8,19L12,15L16,19H13V22H11V19H8Z" />
    </svg>
  );
}

export function DiffView({ diff, filepath, defaultExpanded = true }: DiffViewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { diffLines, highlightedHtml } = useMemo(() => {
    const lines = parsePatch(diff);
    const lang = filepath ? extensionToLanguage(filepath) : null;
    return { diffLines: lines, highlightedHtml: highlightLines(lines, lang) };
  }, [diff, filepath]);

  if (diffLines.length === 0) return null;

  return (
    <div class="diff-view-wrap">
      <div class="diff-view-header">
        <button
          class="diff-view-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse diff" : "Expand diff"}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
        {filepath && <span class="diff-view-filepath">{filepath}</span>}
      </div>
      {expanded && (
        <pre class="diff-view">
          <code class="language-plaintext">
            {diffLines.map((line, i) => (
              <div class={`diff-line diff-line--${line.type}`}>
                <span class="diff-lineno">{line.oldNo ?? ""}</span>
                <span class="diff-lineno">{line.newNo ?? ""}</span>
                <span class="diff-indicator">{INDICATOR[line.type]}</span>
                <span dangerouslySetInnerHTML={{ __html: highlightedHtml[i] || "" }} />
              </div>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}
