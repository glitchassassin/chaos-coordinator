import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { encodeDirectory, readLog, findLogDir, watchLog, readCwd, listConversations } from "./logs.js";

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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const unwatch = watchLog(filePath, () => {});
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  test("returns no-op for nonexistent file", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const unwatch = watchLog("/no/such/file.jsonl", () => {});
    expect(typeof unwatch).toBe("function");
    unwatch(); // should not throw
  });
});

// ── readCwd ────────────────────────────────────────────────────────────────────

describe("readCwd", () => {
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

  test("reads cwd from first entry that has it", () => {
    const lines = [
      JSON.stringify({ type: "system", data: "no cwd here" }),
      JSON.stringify({ cwd: "/Users/test/project", type: "user", message: { role: "user", content: "hi" } }),
      JSON.stringify({ cwd: "/Users/test/other", type: "assistant", message: { role: "assistant", content: "world" } }),
    ];
    fs.writeFileSync(filePath, lines.join("\n"));
    expect(readCwd(filePath)).toBe("/Users/test/project");
  });

  test("returns null when no entry has cwd", () => {
    const line = JSON.stringify({ type: "user", message: { role: "user", content: "hi" } });
    fs.writeFileSync(filePath, line);
    expect(readCwd(filePath)).toBeNull();
  });

  test("returns null for nonexistent file", () => {
    expect(readCwd("/no/such/file.jsonl")).toBeNull();
  });

  test("skips empty cwd strings", () => {
    const lines = [
      JSON.stringify({ cwd: "", type: "user", message: { role: "user", content: "hi" } }),
      JSON.stringify({ cwd: "/real/path", type: "user", message: { role: "user", content: "hi" } }),
    ];
    fs.writeFileSync(filePath, lines.join("\n"));
    expect(readCwd(filePath)).toBe("/real/path");
  });
});

// ── listConversations ──────────────────────────────────────────────────────────

describe("listConversations", () => {
  let tmpDir: string;
  let origHome: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `chaos-test-${crypto.randomUUID()}`);
    origHome = process.env.HOME ?? os.homedir();
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array when directory does not exist", () => {
    expect(listConversations("-nonexistent")).toEqual([]);
  });

  test("lists JSONL files sorted by mtime (newest first)", () => {
    const dir = path.join(tmpDir, ".claude", "projects", "-test-dir");
    fs.mkdirSync(dir, { recursive: true });

    const id1 = "aaaa-1111";
    const id2 = "bbbb-2222";
    fs.writeFileSync(path.join(dir, `${id1}.jsonl`), "{}");
    // Ensure different mtimes
    const now = Date.now();
    fs.utimesSync(path.join(dir, `${id1}.jsonl`), new Date(now - 10000), new Date(now - 10000));
    fs.writeFileSync(path.join(dir, `${id2}.jsonl`), "{}");

    const result = listConversations("-test-dir");
    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe(id2); // newer
    expect(result[1].sessionId).toBe(id1); // older
  });

  test("ignores non-JSONL files", () => {
    const dir = path.join(tmpDir, ".claude", "projects", "-test-dir2");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "test.jsonl"), "{}");
    fs.writeFileSync(path.join(dir, "readme.txt"), "hello");
    fs.mkdirSync(path.join(dir, "subagents"));

    const result = listConversations("-test-dir2");
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("test");
  });
});
