import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { highlight, escapeHtml, extensionToLanguage } from "../util/highlight.js";
import { instanceUrl } from "../hooks/use-api.js";
import type { FileStatus, FileContent } from "../types.js";

interface Props {
  instanceId: string;
  onInsertMention?: (filePath: string, startLine: number, endLine: number) => void;
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
  return diffLines.map((line) => {
    if (!line.content) return "";
    return language ? highlight(line.content, language) : escapeHtml(line.content);
  });
}

interface GitInfo {
  branch: string | null;
  ahead: number;
  behind: number;
}

export function GitStatus({ instanceId, onInsertMention }: Props) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{ rect: DOMRect; startLine: number; endLine: number } | null>(null);
  const diffScrollRef = useRef<HTMLDivElement | null>(null);

  const loadFiles = useCallback(() => {
    setLoading(true);
    fetch(`/api/instances/${instanceId}/git/info`)
      .then((r) => r.json())
      .then((data: GitInfo) => setGitInfo(data))
      .catch(console.error);
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
    setSelectionInfo(null);
  }, []);

  const getLineNumber = useCallback((node: Node): number | null => {
    let el: Element | null = node instanceof Element ? node : node.parentElement;
    while (el) {
      if (el.classList.contains("diff-line")) {
        // Two .diff-lineno spans (old, new) — prefer last non-empty (new side)
        const linenos = el.querySelectorAll(".diff-lineno");
        for (let i = linenos.length - 1; i >= 0; i--) {
          const text = linenos[i].textContent?.trim();
          if (text) return parseInt(text, 10);
        }
      }
      el = el.parentElement;
    }
    return null;
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0 && diffScrollRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const startLine = getLineNumber(range.startContainer);
        const endLine = getLineNumber(range.endContainer);
        if (startLine !== null && endLine !== null) {
          setSelectionInfo({ rect: range.getBoundingClientRect(), startLine, endLine });
          return;
        }
      }
      setSelectionInfo(null);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [getLineNumber]);

  if (selected && diffLines !== null) {
    return (
      <div class="git-diff-view">
        <div class="panel-header">
          <button class="btn btn-icon" onClick={handleBack} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20,9V15H12V19.84L4.16,12L12,4.16V9H20Z" />
            </svg>
          </button>
          <span class="panel-header-title">{selected}</span>
        </div>
        <div class="git-diff-scroll" ref={diffScrollRef}>
          <pre class="diff-view">
            <code class="language-plaintext">
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
        {selectionInfo && onInsertMention && (
          <button
            class="btn file-mention-btn"
            style={`position: fixed; top: ${selectionInfo.rect.top - 4}px; left: ${diffScrollRef.current?.querySelector(".diff-line > span:last-child")?.getBoundingClientRect().left ?? selectionInfo.rect.left}px; transform: translateY(-100%);`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              onInsertMention(selected!, selectionInfo.startLine, selectionInfo.endLine);
              setSelectionInfo(null);
              window.getSelection()?.removeAllRanges();
            }}
            aria-label="Insert file mention"
          >
            {/* mdi:arrow-down-bold */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9,4H15V12H19.84L12,19.84L4.16,12H9V4Z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div class="git-file-list">
      <div class="panel-header">
        <span class="panel-header-title">Changes</span>
        {gitInfo?.branch && (
          <span class="git-branch-info">
            {/* mdi:source-branch */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13,14C9.64,14 8.54,15.35 8.18,16.24C9.25,16.7 10,17.76 10,19A3,3 0 0,1 7,22A3,3 0 0,1 4,19C4,17.69 4.83,16.58 6,16.17V7.83C4.83,7.42 4,6.31 4,5A3,3 0 0,1 7,2A3,3 0 0,1 10,5C10,6.31 9.17,7.42 8,7.83V13.12C8.88,12.47 10.16,12 12,12C14.67,12 15.56,10.87 15.85,10C14.71,9.55 13.91,8.38 13.91,7A3.09,3.09 0 0,1 17,3.91A3.09,3.09 0 0,1 20.09,7C20.09,8.37 19.29,9.54 18.15,10C17.88,11.17 17.08,14 13,14Z" />
            </svg>
            <span class="git-branch-name">{gitInfo.branch}</span>
            {(gitInfo.ahead > 0 || gitInfo.behind > 0) && (
              <span class="git-sync-counts">
                {gitInfo.behind > 0 && <span class="git-sync-behind" title={`${gitInfo.behind} to pull`}>↓{gitInfo.behind}</span>}
                {gitInfo.ahead > 0 && <span class="git-sync-ahead" title={`${gitInfo.ahead} to push`}>↑{gitInfo.ahead}</span>}
              </span>
            )}
          </span>
        )}
        <button class="btn btn-icon" onClick={loadFiles} aria-label="Refresh">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
          </svg>
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
