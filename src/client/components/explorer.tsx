import { useState, useEffect, useCallback } from "preact/hooks";
import { highlight, extensionToLanguage } from "../util/highlight.js";
import { basename, dirname } from "../util/path.js";

interface Props {
  instanceId: string;
  rootPath: string;
}

interface FsEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

export function Explorer({ rootPath }: Props) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileLang, setFileLang] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadDirectory = useCallback((path: string) => {
    setLoading(true);
    fetch(`/api/fs?path=${encodeURIComponent(path)}&files=1`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setCurrentPath(data.path || path);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDirectory(rootPath);
  }, [loadDirectory, rootPath]);

  const handleEntryClick = useCallback(
    (entry: FsEntry) => {
      if (entry.type === "directory") {
        loadDirectory(entry.path);
      } else {
        setFilePath(entry.path);
        setFileContent(null);
        setIsBinary(false);
        fetch(`/api/fs/content?path=${encodeURIComponent(entry.path)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.binary) {
              setIsBinary(true);
            } else {
              const lang = extensionToLanguage(entry.name);
              setFileLang(lang);
              setFileContent(highlight(data.content || "", lang ?? ""));
            }
          })
          .catch(console.error);
      }
    },
    [loadDirectory],
  );

  const handleBack = useCallback(() => {
    setFilePath(null);
    setFileContent(null);
    setFileLang(null);
    setIsBinary(false);
  }, []);

  const navigateUp = useCallback(() => {
    const parent = dirname(currentPath);
    if (parent.length >= rootPath.length) {
      loadDirectory(parent);
    }
  }, [currentPath, rootPath, loadDirectory]);

  if (filePath && (fileContent !== null || isBinary)) {
    const relativeName = filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length).replace(/^\//, "")
      : basename(filePath);
    return (
      <div class="explorer-file-view">
        <div class="panel-header">
          <button class="btn btn-icon" onClick={handleBack} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20,9V15H12V19.84L4.16,12L12,4.16V9H20Z" />
            </svg>
          </button>
          <span class="panel-header-title">{relativeName}</span>
        </div>
        <div class="explorer-file-scroll">
          {isBinary ? (
            <div class="panel-empty">Binary file</div>
          ) : (
            <pre class="diff-view"><code class={`language-${fileLang ?? "plaintext"}`}>
              {fileContent!.split("\n").map((line, i) => (
                <div key={i} class="diff-line">
                  <span class="diff-lineno">{i + 1}</span>
                  <span dangerouslySetInnerHTML={{ __html: line || " " }} />
                </div>
              ))}
            </code></pre>
          )}
        </div>
      </div>
    );
  }

  const relativePath = currentPath.startsWith(rootPath)
    ? currentPath.slice(rootPath.length).replace(/^\//, "")
    : "";
  const breadcrumbs = relativePath ? relativePath.split("/").filter(Boolean) : [];

  return (
    <div class="explorer-file-list">
      <div class="panel-header">
        <span class="panel-header-title breadcrumb">
          <button class="breadcrumb-btn" onClick={() => loadDirectory(rootPath)}>/</button>
          {breadcrumbs.map((seg, i) => {
            const segPath = rootPath + "/" + breadcrumbs.slice(0, i + 1).join("/");
            return (
              <span key={segPath}>
                <button class="breadcrumb-btn" onClick={() => loadDirectory(segPath)}>
                  {seg}
                </button>
                {i < breadcrumbs.length - 1 && " / "}
              </span>
            );
          })}
        </span>
      </div>
      <div class="explorer-list-scroll">
        {loading && <div class="loading">Loading...</div>}
        {currentPath !== rootPath && (
          <button class="file-item" onClick={navigateUp}>
            <span class="file-status-indicator">/</span>
            <span class="file-path">..</span>
          </button>
        )}
        {entries.map((entry) => (
          <button
            key={entry.path}
            class="file-item"
            onClick={() => handleEntryClick(entry)}
          >
            <span class="file-status-indicator">{entry.type === "directory" ? "/" : " "}</span>
            <span class="file-path">{entry.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
