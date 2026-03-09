import { highlight, escapeHtml } from "./highlight.js";

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldNo: number | null;
  newNo: number | null;
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
