import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

import { execSync } from "child_process";
import { listProjects, getProject, clearProjectCache } from "./projects.js";

const mockExecSync = vi.mocked(execSync);

// Create a temp .claude/projects directory structure for testing
function createTempClaudeDir(): string {
  const tmpDir = path.join(os.tmpdir(), `chaos-test-${crypto.randomUUID()}`);
  const projectsDir = path.join(tmpDir, ".claude", "projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  return tmpDir;
}

function addFakeProject(tmpDir: string, encodedDir: string, cwd: string): void {
  const dir = path.join(tmpDir, ".claude", "projects", encodedDir);
  fs.mkdirSync(dir, { recursive: true });
  const logEntry = JSON.stringify({
    cwd,
    sessionId: crypto.randomUUID(),
    type: "user",
    message: { role: "user", content: "hello" },
  });
  fs.writeFileSync(path.join(dir, `${crypto.randomUUID()}.jsonl`), logEntry);
}

describe("listProjects", () => {
  let tmpDir: string;
  let origHome: string;

  beforeEach(() => {
    tmpDir = createTempClaudeDir();
    origHome = process.env.HOME ?? os.homedir();
    // Override HOME so os.homedir() returns our temp dir
    process.env.HOME = tmpDir;
    clearProjectCache();
    mockExecSync.mockImplementation(() => {
      throw new Error("no git");
    });
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no project directories exist", () => {
    expect(listProjects()).toEqual([]);
  });

  it("discovers projects from JSONL cwd field", () => {
    addFakeProject(tmpDir, "-Users-test-myproject", "/Users/test/myproject");
    const projects = listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].encodedDir).toBe("-Users-test-myproject");
    expect(projects[0].directory).toBe("/Users/test/myproject");
    expect(projects[0].name).toBe("myproject");
  });

  it("detects GitHub remote for a project", () => {
    addFakeProject(tmpDir, "-Users-test-repo", "/Users/test/repo");
    mockExecSync.mockReturnValue("git@github.com:acme/widget.git\n");
    const projects = listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("acme/widget");
    expect(projects[0].providerType).toBe("github");
    expect(projects[0].owner).toBe("acme");
    expect(projects[0].repo).toBe("widget");
  });

  it("skips directories without JSONL files", () => {
    const dir = path.join(tmpDir, ".claude", "projects", "-Users-empty");
    fs.mkdirSync(dir, { recursive: true });
    expect(listProjects()).toEqual([]);
  });

  it("skips directories where no JSONL has a cwd field", () => {
    const dir = path.join(tmpDir, ".claude", "projects", "-Users-nocwd");
    fs.mkdirSync(dir, { recursive: true });
    // Write a JSONL file without a cwd field
    const entry = JSON.stringify({ type: "user", message: { role: "user", content: "hi" } });
    fs.writeFileSync(path.join(dir, "test.jsonl"), entry);
    expect(listProjects()).toEqual([]);
  });

  it("caches results on subsequent calls", () => {
    addFakeProject(tmpDir, "-Users-test-cached", "/Users/test/cached");
    const first = listProjects();
    // Add another project — should not appear due to cache
    addFakeProject(tmpDir, "-Users-test-new", "/Users/test/new");
    const second = listProjects();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("returns fresh data after cache cleared", () => {
    addFakeProject(tmpDir, "-Users-test-cached2", "/Users/test/cached2");
    listProjects();
    clearProjectCache();
    addFakeProject(tmpDir, "-Users-test-new2", "/Users/test/new2");
    const result = listProjects();
    expect(result).toHaveLength(2);
  });
});

describe("getProject", () => {
  let tmpDir: string;
  let origHome: string;

  beforeEach(() => {
    tmpDir = createTempClaudeDir();
    origHome = process.env.HOME ?? os.homedir();
    process.env.HOME = tmpDir;
    clearProjectCache();
    mockExecSync.mockImplementation(() => {
      throw new Error("no git");
    });
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns project by encoded directory", () => {
    addFakeProject(tmpDir, "-Users-test-proj", "/Users/test/proj");
    const project = getProject("-Users-test-proj");
    expect(project).toBeDefined();
    expect(project?.directory).toBe("/Users/test/proj");
  });

  it("returns undefined for unknown encoded directory", () => {
    expect(getProject("-nonexistent")).toBeUndefined();
  });
});
