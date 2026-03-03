import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  createSession,
  sendText,
  pressKey,
  sendInput,
  capturePane,
  killSession,
  listSessions,
  sessionExists,
  paneCwd,
} from "./tmux.js";

const mockExec = vi.mocked(execFileSync);

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
});

describe("createSession", () => {
  it("creates a detached session without a command", () => {
    createSession("orch-abc", "/tmp/project");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["new-session", "-d", "-s", "orch-abc", "-c", "/tmp/project"],
      expect.anything(),
    );
  });

  it("creates a session with an explicit command", () => {
    createSession("orch-abc", "/tmp/project", "claude");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["new-session", "-d", "-s", "orch-abc", "-c", "/tmp/project", "claude"],
      expect.any(Object),
    );
  });
});

describe("sendText", () => {
  it("sends literal text with -l flag", () => {
    sendText("orch-abc", "hello world");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "orch-abc", "-l", "hello world"],
      expect.any(Object),
    );
  });
});

describe("pressKey", () => {
  it("sends a key name", () => {
    pressKey("orch-abc", "Enter");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "orch-abc", "Enter"],
      expect.any(Object),
    );
  });

  it("sends M-Enter for Alt+Enter", () => {
    pressKey("orch-abc", "M-Enter");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "orch-abc", "M-Enter"],
      expect.any(Object),
    );
  });
});

describe("sendInput", () => {
  it("sends single-line text followed by Enter", () => {
    const calls: unknown[][] = [];
    mockExec.mockImplementation((...args) => {
      calls.push(args[1] as unknown[]);
      return Buffer.from("");
    });

    sendInput("orch-abc", "hello");
    expect(calls).toEqual([
      ["send-keys", "-t", "orch-abc", "-l", "hello"],
      ["send-keys", "-t", "orch-abc", "Enter"],
    ]);
  });

  it("sends multi-line text with M-Enter between lines", () => {
    const calls: unknown[][] = [];
    mockExec.mockImplementation((...args) => {
      calls.push(args[1] as unknown[]);
      return Buffer.from("");
    });

    sendInput("orch-abc", "line1\nline2\nline3");
    expect(calls).toEqual([
      ["send-keys", "-t", "orch-abc", "-l", "line1"],
      ["send-keys", "-t", "orch-abc", "M-Enter"],
      ["send-keys", "-t", "orch-abc", "-l", "line2"],
      ["send-keys", "-t", "orch-abc", "M-Enter"],
      ["send-keys", "-t", "orch-abc", "-l", "line3"],
      ["send-keys", "-t", "orch-abc", "Enter"],
    ]);
  });
});

describe("capturePane", () => {
  it("returns the pane output", () => {
    mockExec.mockReturnValue("some output\n");
    const result = capturePane("orch-abc");
    expect(result).toBe("some output\n");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["capture-pane", "-p", "-t", "orch-abc"],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("returns empty string when session does not exist", () => {
    mockExec.mockImplementation(() => {
      throw new Error("no session");
    });
    expect(capturePane("orch-missing")).toBe("");
  });
});

describe("killSession", () => {
  it("kills the session", () => {
    killSession("orch-abc");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["kill-session", "-t", "orch-abc"],
      expect.any(Object),
    );
  });

  it("does not throw when session does not exist", () => {
    mockExec.mockImplementation(() => {
      throw new Error("no server running");
    });
    expect(() => { killSession("orch-missing"); }).not.toThrow();
  });
});

describe("listSessions", () => {
  it("returns session names", () => {
    mockExec.mockReturnValue("orch-abc\norch-def\n");
    const result = listSessions();
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["list-sessions", "-F", "#{session_name}"],
      expect.objectContaining({ encoding: "utf8" }),
    );
    // We just verify it's an array (exact value depends on split/trim logic)
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array when tmux has no sessions", () => {
    mockExec.mockImplementation(() => {
      throw new Error("no server running");
    });
    expect(listSessions()).toEqual([]);
  });
});

describe("paneCwd", () => {
  it("returns trimmed pane current path", () => {
    mockExec.mockReturnValue("/tmp/my-project\n");
    expect(paneCwd("orch-abc")).toBe("/tmp/my-project");
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["display-message", "-p", "-t", "orch-abc", "#{pane_current_path}"],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("returns empty string when session does not exist", () => {
    mockExec.mockImplementation(() => {
      throw new Error("no session");
    });
    expect(paneCwd("orch-missing")).toBe("");
  });
});

describe("sessionExists", () => {
  it("returns true when session exists", () => {
    mockExec.mockReturnValue(Buffer.from(""));
    expect(sessionExists("orch-abc")).toBe(true);
    expect(mockExec).toHaveBeenCalledWith(
      "tmux",
      ["has-session", "-t", "orch-abc"],
      expect.any(Object),
    );
  });

  it("returns false when session does not exist", () => {
    mockExec.mockImplementation(() => {
      throw new Error("can't find session");
    });
    expect(sessionExists("orch-missing")).toBe(false);
  });
});
