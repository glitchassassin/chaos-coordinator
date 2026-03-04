import { useState, useEffect } from "preact/hooks";
import { basename, dirname } from "../util/path.js";
import type { FsEntry } from "../types.js";

interface Props {
  onSelect: (path: string, name: string) => void;
}

export function DirectoryPicker({ onSelect }: Props) {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (currentPath === "") {
      // Initial load — let server use default (home dir)
      fetch("/api/fs")
        .then((r) => r.json())
        .then((data) => {
          setCurrentPath(data.path);
          setEntries(data.entries);
          setName(basename(data.path));
        })
        .catch(() => setError("Failed to load filesystem"));
    } else {
      fetch(`/api/fs?path=${encodeURIComponent(currentPath)}`)
        .then((r) => r.json())
        .then((data) => {
          setEntries(data.entries);
          setName(basename(data.path));
        })
        .catch(() => setError("Failed to load directory"));
    }
  }, [currentPath]);

  function navigateUp() {
    const parent = dirname(currentPath);
    if (parent && parent !== currentPath) {
      setCurrentPath(parent);
    }
  }

  function navigateTo(path: string) {
    setCurrentPath(path);
  }

  function handleSelect() {
    if (!currentPath) return;
    onSelect(currentPath, name.trim() || basename(currentPath));
  }

  return (
    <div class="dir-picker">
      <div class="dir-picker-topbar">
        <h2 class="dir-picker-title">New Instance</h2>
      </div>

      <div class="dir-picker-list">
        <button class="dir-picker-entry" onClick={navigateUp}>
          ▶ ..
        </button>
        {error && <div class="dir-picker-error">{error}</div>}
        {entries.map((entry) => (
          <button
            key={entry.path}
            class="dir-picker-entry"
            onClick={() => navigateTo(entry.path)}
          >
            ▶ {entry.name}
          </button>
        ))}
        {entries.length === 0 && !error && (
          <div class="loading">No subdirectories</div>
        )}
      </div>

      <div class="dir-picker-footer">
        <span class="dir-picker-path">{currentPath}</span>
        <input
          class="dir-picker-name"
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="name"
          aria-label="Instance name"
        />
        <button class="btn" onClick={handleSelect}>Select</button>
      </div>
    </div>
  );
}
