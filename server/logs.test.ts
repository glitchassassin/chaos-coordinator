import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { encodeDirectory, readLog, findLogDir, watchLog } from "./logs.js";

// ── encodeDirectory ────────────────────────────────────────────────────────────

describe("encodeDirectory", () => {
  test("replaces all slashes with dashes", () => {
    expect(encodeDirectory("/Users/foo/bar")).toBe("-Users-foo-bar");
    expect(encodeDirectory("/home/user/my-project")).toBe("-home-user-my-project");
  });

  test("leading slash becomes leading dash", () => {
    expect(encodeDirectory("/single")).toBe("-single");
  });

  test("empty string passthrough", () => {
    expect(encodeDirectory("")).toBe("");
  });
});

// ── readLog ────────────────────────────────────────────────────────────────────

function tmpFile(): string {
  return path.join(os.tmpdir(), `logs-test-${Date.now()}-${Math.random()}.jsonl`);
}

describe("readLog", () => {
  let filePath: string;

  beforeEach(() => {
    filePath = tmpFile();
  });

  afterEach(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ok */
    }
  });

  test("parses user and assistant entries", () => {
    const lines = [
      JSON.stringify({
        type: "user",
        uuid: "u1",
        timestamp: "2025-01-01T00:00:00Z",
        message: { role: "user", content: [{ type: "text", text: "hello" }] },
      }),
      JSON.stringify({
        type: "assistant",
        uuid: "a1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "world" }],
        },
      }),
      JSON.stringify({ type: "file-history-snapshot", data: {} }),
    ];
    fs.writeFileSync(filePath, lines.join("\n"));

    const result = readLog(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("user");
    expect(result[0].uuid).toBe("u1");
    expect(result[1].type).toBe("assistant");
  });

  test("normalizes string content to text block", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ type: "user", message: { role: "user", content: "hello" } }),
    );
    const result = readLog(filePath);
    expect(result[0].message.content).toEqual([{ type: "text", text: "hello" }]);
  });

  test("skips entries without a message", () => {
    fs.writeFileSync(filePath, JSON.stringify({ type: "user" }));
    expect(readLog(filePath)).toHaveLength(0);
  });

  test("skips malformed JSON lines", () => {
    const lines = [
      "not json at all }{",
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
    ];
    fs.writeFileSync(filePath, lines.join("\n"));
    expect(readLog(filePath)).toHaveLength(1);
  });

  test("skips empty lines", () => {
    const lines = [
      "",
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
      "",
    ];
    fs.writeFileSync(filePath, lines.join("\n"));
    expect(readLog(filePath)).toHaveLength(1);
  });

  test("returns empty array for nonexistent file", () => {
    expect(readLog("/no/such/file.jsonl")).toEqual([]);
  });

  test("preserves tool_use blocks", () => {
    const entry = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "Read", input: { file_path: "/foo" } },
        ],
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(entry));
    const result = readLog(filePath);
    expect(result[0].message.content[0]).toMatchObject({ type: "tool_use", name: "Read" });
  });

  test("preserves thinking blocks", () => {
    const entry = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "hmm", signature: "abc" }],
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(entry));
    const result = readLog(filePath);
    expect(result[0].message.content[0]).toMatchObject({ type: "thinking", thinking: "hmm" });
  });

  test("preserves tool_result blocks", () => {
    const entry = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: "file contents" }],
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(entry));
    const result = readLog(filePath);
    expect(result[0].message.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
  });
});

// ── findLogDir ─────────────────────────────────────────────────────────────────

describe("findLogDir", () => {
  test("returns null for nonexistent directory", () => {
    expect(findLogDir("/no/such/project/path/xyz")).toBeNull();
  });
});

// ── watchLog ───────────────────────────────────────────────────────────────────

describe("watchLog", () => {
  let filePath: string;

  beforeEach(() => {
    filePath = tmpFile();
    fs.writeFileSync(filePath, "");
  });

  afterEach(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ok */
    }
  });

  test("returns an unwatch function without throwing", () => {
    const unwatch = watchLog(filePath, () => {});
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  test("returns no-op for nonexistent file", () => {
    const unwatch = watchLog("/no/such/file.jsonl", () => {});
    expect(typeof unwatch).toBe("function");
    unwatch(); // should not throw
  });
});
