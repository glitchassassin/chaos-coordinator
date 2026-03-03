import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./tmux.js", () => ({
  createSession: vi.fn(),
  sendInput: vi.fn(),
  capturePane: vi.fn().mockReturnValue(""),
  killSession: vi.fn(),
  listSessions: vi.fn().mockReturnValue([]),
  sessionExists: vi.fn().mockReturnValue(true),
}));

import * as tmux from "./tmux.js";
import {
  launchAgent,
  sendInput,
  readScreen,
  terminateAgent,
  listAgents,
  getAgent,
  reconcileAgents,
  pollAgent,
  inferStatus,
  _clearAgents,
} from "./agents.js";

const mockTmux = vi.mocked(tmux);

beforeEach(() => {
  _clearAgents();
  mockTmux.createSession.mockReset();
  mockTmux.sendInput.mockReset();
  mockTmux.capturePane.mockReturnValue("");
  mockTmux.killSession.mockReset();
  mockTmux.listSessions.mockReturnValue([]);
  mockTmux.sessionExists.mockReturnValue(true);
});

describe("inferStatus", () => {
  it("returns 'active' for normal output", () => {
    expect(inferStatus("some terminal output\n")).toBe("active");
  });

  it("returns 'waiting' when output contains (y/N) prompt", () => {
    expect(inferStatus("Do you want to proceed? (y/N)")).toBe("waiting");
  });

  it("returns 'waiting' when output contains 'Do you want to'", () => {
    expect(inferStatus("Do you want to delete this file?")).toBe("waiting");
  });

  it("returns 'waiting' when output contains 'Allow'", () => {
    expect(inferStatus("Allow bash_20250101_abc123 command\n[A]llow")).toBe("waiting");
  });

  it("returns 'waiting' when output contains 'Press Enter'", () => {
    expect(inferStatus("Press Enter to continue")).toBe("waiting");
  });
});

describe("launchAgent", () => {
  it("creates a tmux session named orch-{id}", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    expect(mockTmux.createSession).toHaveBeenCalledWith(
      `orch-${agent.id}`,
      "/tmp/test",
      "claude",
    );
    expect(agent.tmuxSession).toBe(`orch-${agent.id}`);
  });

  it("creates agent with status 'starting'", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    expect(agent.status).toBe("starting");
    expect(agent.encodedDir).toBe("enc-dir");
    expect(agent.directory).toBe("/tmp/test");
  });

  it("sends initial prompt when provided", () => {
    const prompt = "Fix the bug in main.ts";
    launchAgent("enc-dir", "/tmp/test", prompt);
    expect(mockTmux.sendInput).toHaveBeenCalledWith(expect.stringMatching(/^orch-/), prompt);
  });

  it("does not call sendInput when no prompt", () => {
    launchAgent("enc-dir", "/tmp/test");
    expect(mockTmux.sendInput).not.toHaveBeenCalled();
  });

  it("does not call sendInput for blank prompt", () => {
    launchAgent("enc-dir", "/tmp/test", "   ");
    expect(mockTmux.sendInput).not.toHaveBeenCalled();
  });

  it("assigns unique IDs to each agent", () => {
    const a = launchAgent("enc-dir", "/tmp/test");
    const b = launchAgent("enc-dir", "/tmp/test");
    expect(a.id).not.toBe(b.id);
    expect(a.tmuxSession).not.toBe(b.tmuxSession);
  });
});

describe("sendInput", () => {
  it("sends text to the agent's tmux session", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    mockTmux.sendInput.mockReset();
    sendInput(agent.id, "hello");
    expect(mockTmux.sendInput).toHaveBeenCalledWith(agent.tmuxSession, "hello");
  });

  it("throws when agent does not exist", () => {
    expect(() => { sendInput("nonexistent", "hi"); }).toThrow("Agent not found");
  });
});

describe("readScreen", () => {
  it("returns captured pane output", () => {
    mockTmux.capturePane.mockReturnValue("screen content\n");
    const agent = launchAgent("enc-dir", "/tmp/test");
    const screen = readScreen(agent.id);
    expect(screen).toBe("screen content\n");
    expect(mockTmux.capturePane).toHaveBeenCalledWith(agent.tmuxSession);
  });

  it("throws when agent does not exist", () => {
    expect(() => readScreen("nonexistent")).toThrow("Agent not found");
  });
});

describe("terminateAgent", () => {
  it("sends /exit then kills the tmux session", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    mockTmux.sendInput.mockReset();
    terminateAgent(agent.id);
    expect(mockTmux.sendInput).toHaveBeenCalledWith(agent.tmuxSession, "/exit");
    expect(mockTmux.killSession).toHaveBeenCalledWith(agent.tmuxSession);
  });

  it("removes agent from store after termination", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    terminateAgent(agent.id);
    expect(getAgent(agent.id)).toBeUndefined();
  });

  it("is a no-op for an unknown agent id", () => {
    expect(() => { terminateAgent("nonexistent"); }).not.toThrow();
  });
});

describe("listAgents", () => {
  it("returns empty array when no agents", () => {
    expect(listAgents()).toEqual([]);
  });

  it("returns all agents", () => {
    launchAgent("enc-dir", "/tmp/test");
    launchAgent("enc-dir", "/tmp/test");
    expect(listAgents()).toHaveLength(2);
  });

  it("filters by encodedDir", () => {
    launchAgent("dir-a", "/tmp/a");
    launchAgent("dir-b", "/tmp/b");
    expect(listAgents("dir-a")).toHaveLength(1);
    expect(listAgents("dir-b")).toHaveLength(1);
  });
});

describe("reconcileAgents", () => {
  it("removes agents when their session is gone", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    mockTmux.listSessions.mockReturnValue([]);
    reconcileAgents();
    expect(getAgent(agent.id)).toBeUndefined();
  });

  it("keeps agents when their session still exists", () => {
    const agent = launchAgent("enc-dir", "/tmp/test");
    mockTmux.listSessions.mockReturnValue([agent.tmuxSession]);
    reconcileAgents();
    expect(getAgent(agent.id)).toBeDefined();
  });

  it("adopts orphan orch-* sessions", () => {
    mockTmux.listSessions.mockReturnValue(["orch-orphan-123"]);
    reconcileAgents();
    expect(getAgent("orphan-123")).toBeDefined();
    expect(getAgent("orphan-123")?.tmuxSession).toBe("orch-orphan-123");
  });
});

describe("pollAgent", () => {
  it("sets status to active on first poll", () => {
    mockTmux.capturePane.mockReturnValue("some output\n");
    const agent = launchAgent("enc-dir", "/tmp/test");
    pollAgent(agent.id);
    expect(getAgent(agent.id)?.status).toBe("active");
  });

  it("sets status to waiting when output contains a prompt", () => {
    mockTmux.capturePane.mockReturnValue("Do you want to proceed? (y/N)");
    const agent = launchAgent("enc-dir", "/tmp/test");
    pollAgent(agent.id);
    expect(getAgent(agent.id)?.status).toBe("waiting");
  });

  it("removes agent when session disappears", () => {
    mockTmux.sessionExists.mockReturnValue(false);
    const agent = launchAgent("enc-dir", "/tmp/test");
    pollAgent(agent.id);
    expect(getAgent(agent.id)).toBeUndefined();
  });

  it("is a no-op for unknown agent ids", () => {
    mockTmux.capturePane.mockClear();
    pollAgent("nonexistent");
    expect(mockTmux.capturePane).not.toHaveBeenCalled();
  });
});
