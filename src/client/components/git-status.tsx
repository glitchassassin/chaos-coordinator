import { useState, useEffect, useCallback } from "preact/hooks";
import { hljs, extensionToLanguage } from "../util/highlight.js";
import { instanceUrl } from "../hooks/use-api.js";
import type { FileStatus, FileContent } from "../types.js";

interface Props {
  instanceId: string;
}

interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldNo: number | null;
  newNo: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  added: "A",
  deleted: "D",
  modified: "M",
};

const INDICATOR: Record<string, string> = {
  add: "+",
  remove: "\u2212",
  context: " ",
};

function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNo = parseInt(match[1], 10);
        newNo = parseInt(match[2], 10);
      }
    } else if (raw.startsWith("---") || raw.startsWith("+++")) {
      // skip old/new filename headers
    } else if (raw.startsWith("+")) {
      lines.push({ type: "add", content: raw.slice(1), oldNo: null, newNo });
      newNo++;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "remove", content: raw.slice(1), oldNo, newNo: null });
      oldNo++;
    } else if (raw.startsWith(" ")) {
      lines.push({ type: "context", content: raw.slice(1), oldNo, newNo });
      oldNo++;
      newNo++;
    }
  }
  return lines;
}

function highlightLines(
  diffLines: DiffLine[],
  language: string | null,
): string[] {
  const lang = language && hljs.getLanguage(language) ? language : null;
  return diffLines.map((line) => {
    if (!line.content) return "";
    if (lang) return hljs.highlight(line.content, { language: lang }).value;
    return hljs.highlightAuto(line.content).value;
  });
}

export function GitStatus({ instanceId }: Props) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(() => {
    setLoading(true);
    fetch(instanceUrl(instanceId, "/file/status"))
      .then((r) => r.json())
      .then((data) => {
        const list: FileStatus[] = Array.isArray(data)
          ? data
          : Object.values(data || {});
        setFiles(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instanceId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSelect = useCallback(
    (path: string) => {
      setSelected(path);
      setDiffLines(null);
      setHighlightedHtml([]);
      fetch(instanceUrl(instanceId, `/file/content?path=${encodeURIComponent(path)}`))
        .then((r) => r.json())
        .then((data: FileContent) => {
          const raw = data.diff || data.patch || "";
          if (!raw) {
            const content = data.content || "";
            const lines = content.split("\n").map(
              (line, i): DiffLine => ({ type: "add", content: line, oldNo: null, newNo: i + 1 }),
            );
            const lang = extensionToLanguage(path);
            setDiffLines(lines);
            setHighlightedHtml(highlightLines(lines, lang));
            return;
          }
          const parsed = parsePatch(raw);
          const lang = extensionToLanguage(path);
          setDiffLines(parsed);
          setHighlightedHtml(highlightLines(parsed, lang));
        })
        .catch(console.error);
    },
    [instanceId],
  );

  const handleBack = useCallback(() => {
    setSelected(null);
    setDiffLines(null);
    setHighlightedHtml([]);
  }, []);

  if (selected && diffLines !== null) {
    return (
      <div class="git-diff-view">
        <div class="panel-header">
          <button class="btn btn--small" onClick={handleBack}>Back</button>
          <span class="panel-header-title">{selected}</span>
        </div>
        <div class="git-diff-scroll">
          <pre class="diff-view">
            <code class="hljs">
              {diffLines.map((line, i) => (
                <div key={i} class={`diff-line diff-line--${line.type}`}>
                  <span class="diff-lineno">{line.oldNo ?? ""}</span>
                  <span class="diff-lineno">{line.newNo ?? ""}</span>
                  <span class="diff-indicator">{INDICATOR[line.type]}</span>
                  <span dangerouslySetInnerHTML={{ __html: highlightedHtml[i] || "" }} />
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div class="git-file-list">
      <div class="panel-header">
        <span class="panel-header-title">Changes</span>
        <button class="btn btn--small" onClick={loadFiles}>
          Refresh
        </button>
      </div>
      <div class="git-file-list-scroll">
        {loading && <div class="loading">Loading...</div>}
        {!loading && files.length === 0 && (
          <div class="panel-empty">No uncommitted changes.</div>
        )}
        {files.map((f) => (
          <button
            key={f.path}
            class="file-item"
            onClick={() => handleSelect(f.path)}
          >
            <span class="file-status-indicator">{STATUS_LABEL[f.status] || "?"}</span>
            <span class="file-path">{f.path}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
