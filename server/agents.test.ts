import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { mkdirSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("./tmux.js", () => ({
  createSession: vi.fn(),
  sendInput: vi.fn(),
  capturePane: vi.fn().mockReturnValue(""),
  killSession: vi.fn(),
  listSessions: vi.fn().mockReturnValue([]),
  sessionExists: vi.fn().mockReturnValue(true),
}));

import * as tmux from "./tmux.js";
import { createTestDb } from "../db/client.js";
import { projects } from "../db/schema.js";
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
} from "./agents.js";

const mockTmux = vi.mocked(tmux);

function makeTempDir(): string {
  const dir = join(tmpdir(), `chaos-test-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function seedProject(db: ReturnType<typeof createTestDb>, directory: string) {
  const id = crypto.randomUUID();
  db.insert(projects)
    .values({ id, name: "test-project", directory, createdAt: new Date().toISOString() })
    .run();
  return id;
}

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
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.sendInput.mockReset();
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("creates a tmux session named orch-{id}", () => {
    const agent = launchAgent(projectId, undefined, db);
    expect(mockTmux.createSession).toHaveBeenCalledWith(
      `orch-${agent.id}`,
      tempDir,
      "claude",
    );
    expect(agent.tmuxSession).toBe(`orch-${agent.id}`);
  });

  it("inserts agent with status 'starting'", () => {
    const agent = launchAgent(projectId, undefined, db);
    expect(agent.status).toBe("starting");
    expect(agent.projectId).toBe(projectId);
    expect(agent.endedAt).toBeNull();
  });

  it("sends initial prompt when provided", () => {
    const prompt = "Fix the bug in main.ts";
    launchAgent(projectId, prompt, db);
    expect(mockTmux.sendInput).toHaveBeenCalledWith(expect.stringMatching(/^orch-/), prompt);
  });

  it("does not call sendInput when no prompt", () => {
    launchAgent(projectId, undefined, db);
    expect(mockTmux.sendInput).not.toHaveBeenCalled();
  });

  it("does not call sendInput for blank prompt", () => {
    launchAgent(projectId, "   ", db);
    expect(mockTmux.sendInput).not.toHaveBeenCalled();
  });

  it("throws when project does not exist", () => {
    expect(() => launchAgent("nonexistent", undefined, db)).toThrow("Project not found");
  });

  it("throws when project is soft-deleted", () => {
    db.update(projects)
      .set({ removedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))
      .run();
    expect(() => launchAgent(projectId, undefined, db)).toThrow("removed");
  });

  it("assigns unique IDs to each agent", () => {
    const a = launchAgent(projectId, undefined, db);
    const b = launchAgent(projectId, undefined, db);
    expect(a.id).not.toBe(b.id);
    expect(a.tmuxSession).not.toBe(b.tmuxSession);
  });
});

describe("sendInput", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.sendInput.mockReset();
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("sends text to the agent's tmux session", () => {
    const agent = launchAgent(projectId, undefined, db);
    mockTmux.sendInput.mockReset();
    sendInput(agent.id, "hello", db);
    expect(mockTmux.sendInput).toHaveBeenCalledWith(agent.tmuxSession, "hello");
  });

  it("throws when agent does not exist", () => {
    expect(() => { sendInput("nonexistent", "hi", db); }).toThrow("Agent not found");
  });

  it("throws when agent is terminated", () => {
    const agent = launchAgent(projectId, undefined, db);
    terminateAgent(agent.id, db);
    expect(() => { sendInput(agent.id, "hi", db); }).toThrow("terminated");
  });
});

describe("readScreen", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.capturePane.mockReturnValue("screen content\n");
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("returns captured pane output", () => {
    const agent = launchAgent(projectId, undefined, db);
    const screen = readScreen(agent.id, db);
    expect(screen).toBe("screen content\n");
    expect(mockTmux.capturePane).toHaveBeenCalledWith(agent.tmuxSession);
  });

  it("throws when agent does not exist", () => {
    expect(() => readScreen("nonexistent", db)).toThrow("Agent not found");
  });
});

describe("terminateAgent", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.killSession.mockReset();
    mockTmux.sendInput.mockReset();
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("sends /exit then kills the tmux session", () => {
    const agent = launchAgent(projectId, undefined, db);
    mockTmux.sendInput.mockReset();
    terminateAgent(agent.id, db);
    expect(mockTmux.sendInput).toHaveBeenCalledWith(agent.tmuxSession, "/exit");
    expect(mockTmux.killSession).toHaveBeenCalledWith(agent.tmuxSession);
  });

  it("marks agent as terminated with endedAt set", () => {
    const agent = launchAgent(projectId, undefined, db);
    terminateAgent(agent.id, db);
    expect(getAgent(agent.id, db)?.status).toBe("terminated");
    expect(getAgent(agent.id, db)?.endedAt).not.toBeNull();
  });

  it("is a no-op for an unknown agent id", () => {
    expect(() => { terminateAgent("nonexistent", db); }).not.toThrow();
  });

  it("skips send-keys/kill when already terminated", () => {
    const agent = launchAgent(projectId, undefined, db);
    terminateAgent(agent.id, db);
    mockTmux.killSession.mockReset();
    mockTmux.sendInput.mockReset();
    terminateAgent(agent.id, db);
    expect(mockTmux.killSession).not.toHaveBeenCalled();
    expect(mockTmux.sendInput).not.toHaveBeenCalled();
  });
});

describe("listAgents", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("returns empty array when no agents", () => {
    expect(listAgents(undefined, db)).toEqual([]);
  });

  it("returns all agents", () => {
    launchAgent(projectId, undefined, db);
    launchAgent(projectId, undefined, db);
    expect(listAgents(undefined, db)).toHaveLength(2);
  });

  it("filters by projectId", () => {
    const dir2 = makeTempDir();
    const pid2 = seedProject(db, dir2);
    try {
      launchAgent(projectId, undefined, db);
      launchAgent(pid2, undefined, db);
      expect(listAgents(projectId, db)).toHaveLength(1);
      expect(listAgents(pid2, db)).toHaveLength(1);
    } finally {
      rmdirSync(dir2);
    }
  });
});

describe("reconcileAgents", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.listSessions.mockReturnValue([]);
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("marks agents as terminated when their session is gone", () => {
    const agent = launchAgent(projectId, undefined, db);
    mockTmux.listSessions.mockReturnValue([]);
    reconcileAgents(db);
    expect(getAgent(agent.id, db)?.status).toBe("terminated");
  });

  it("leaves agents alone when their session still exists", () => {
    const agent = launchAgent(projectId, undefined, db);
    mockTmux.listSessions.mockReturnValue([agent.tmuxSession]);
    reconcileAgents(db);
    expect(getAgent(agent.id, db)?.status).toBe("starting");
  });

  it("does not re-terminate already terminated agents", () => {
    const agent = launchAgent(projectId, undefined, db);
    terminateAgent(agent.id, db);
    const before = getAgent(agent.id, db)?.endedAt;
    reconcileAgents(db);
    expect(getAgent(agent.id, db)?.endedAt).toBe(before);
  });
});

describe("pollAgent", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    projectId = seedProject(db, tempDir);
    mockTmux.createSession.mockReset();
    mockTmux.sessionExists.mockReturnValue(true);
    mockTmux.capturePane.mockReturnValue("some output\n");
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("sets status to active on first poll", () => {
    const agent = launchAgent(projectId, undefined, db);
    pollAgent(agent.id, db);
    expect(getAgent(agent.id, db)?.status).toBe("active");
  });

  it("sets status to waiting when output contains a prompt", () => {
    mockTmux.capturePane.mockReturnValue("Do you want to proceed? (y/N)");
    const agent = launchAgent(projectId, undefined, db);
    pollAgent(agent.id, db);
    expect(getAgent(agent.id, db)?.status).toBe("waiting");
  });

  it("terminates agent when session disappears", () => {
    mockTmux.sessionExists.mockReturnValue(false);
    const agent = launchAgent(projectId, undefined, db);
    pollAgent(agent.id, db);
    expect(getAgent(agent.id, db)?.status).toBe("terminated");
  });

  it("is a no-op for terminated agents", () => {
    const agent = launchAgent(projectId, undefined, db);
    terminateAgent(agent.id, db);
    mockTmux.capturePane.mockClear();
    pollAgent(agent.id, db);
    expect(mockTmux.capturePane).not.toHaveBeenCalled();
  });
});
