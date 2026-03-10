import { highlight, escapeHtml } from "./highlight.js";

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface DiffFileSummary {
  path: string;
  additions: number;
  deletions: number;
}

export const INDICATOR: Record<string, string> = {
  add: "+",
  remove: "\u2212",
  context: " ",
};

export function parsePatch(patch: string): DiffLine[] {
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

export function highlightLines(
  diffLines: DiffLine[],
  language: string | null,
): string[] {
  return diffLines.map((line) => {
    if (!line.content) return "";
    return language ? highlight(line.content, language) : escapeHtml(line.content);
  });
}

export function summarizePatch(patch: string): DiffFileSummary[] {
  const files: DiffFileSummary[] = [];
  let current: DiffFileSummary | null = null;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (current) files.push(current);
      const match = raw.match(/^diff --git a\/(.+) b\/(.+)$/);
      const path = match?.[2] || match?.[1] || "unknown";
      current = { path, additions: 0, deletions: 0 };
      continue;
    }

    if (raw.startsWith("+++ ")) {
      if (!current) {
        const path = raw.replace(/^\+\+\+ [ab]\//, "").replace(/^\+\+\+ /, "") || "unknown";
        current = { path, additions: 0, deletions: 0 };
      }
      continue;
    }

    if (!current || raw.startsWith("+++ ") || raw.startsWith("--- ")) continue;
    if (raw.startsWith("+")) current.additions++;
    if (raw.startsWith("-")) current.deletions++;
  }

  if (current) files.push(current);
  return files;
}
