import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Hoist mock so it applies before module import
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

import { execSync } from "child_process";
import { createTestDb } from "../db/client.js";
import { addProject, listProjects, removeProject } from "./projects.js";

const mockExecSync = vi.mocked(execSync);

function makeTempDir(): string {
  const dir = join(tmpdir(), `chaos-test-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("addProject", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    mockExecSync.mockReturnValue("");
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("adds a project with basename as name when no git remote", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const project = addProject(tempDir, db);
    expect(project.name).toBe(tempDir.split("/").at(-1));
    expect(project.directory).toBe(tempDir);
    expect(project.remoteUrl).toBeNull();
    expect(project.providerType).toBeNull();
    expect(project.owner).toBeNull();
    expect(project.repo).toBeNull();
  });

  it("adds a project with owner/repo name for GitHub remote", () => {
    mockExecSync.mockReturnValue("git@github.com:acme/widget.git\n");
    const project = addProject(tempDir, db);
    expect(project.name).toBe("acme/widget");
    expect(project.remoteUrl).toBe("git@github.com:acme/widget.git");
    expect(project.providerType).toBe("github");
    expect(project.owner).toBe("acme");
    expect(project.repo).toBe("widget");
  });

  it("adds a project with owner/repo name for Azure DevOps remote", () => {
    mockExecSync.mockReturnValue(
      "https://dev.azure.com/myorg/myproject/_git/myrepo\n",
    );
    const project = addProject(tempDir, db);
    expect(project.name).toBe("myorg/myrepo");
    expect(project.providerType).toBe("azure-devops");
    expect(project.owner).toBe("myorg");
    expect(project.repo).toBe("myrepo");
  });

  it("uses basename when remote URL is unrecognized", () => {
    mockExecSync.mockReturnValue("https://gitlab.com/owner/repo.git\n");
    const project = addProject(tempDir, db);
    expect(project.name).toBe(tempDir.split("/").at(-1));
    expect(project.remoteUrl).toBe("https://gitlab.com/owner/repo.git");
    expect(project.providerType).toBeNull();
  });

  it("throws when directory does not exist", () => {
    expect(() => addProject("/nonexistent/path/12345", db)).toThrow(
      "Directory not found",
    );
  });

  it("assigns a unique UUID id", () => {
    const a = addProject(tempDir, db);
    const otherDir = makeTempDir();
    try {
      const b = addProject(otherDir, db);
      expect(a.id).not.toBe(b.id);
    } finally {
      rmdirSync(otherDir);
    }
  });

  it("returns the existing project when the same directory is added twice", () => {
    const a = addProject(tempDir, db);
    const b = addProject(tempDir, db);
    expect(b.id).toBe(a.id);
  });

  it("restores a removed project when its directory is re-added", () => {
    const original = addProject(tempDir, db);
    removeProject(original.id, db);
    expect(listProjects(db)).toHaveLength(0);
    const restored = addProject(tempDir, db);
    expect(restored.id).toBe(original.id);
    expect(restored.removedAt).toBeNull();
    expect(listProjects(db)).toHaveLength(1);
  });
});

describe("listProjects", () => {
  let db: ReturnType<typeof createTestDb>;
  let dirs: string[];

  beforeEach(() => {
    db = createTestDb();
    dirs = [];
    mockExecSync.mockImplementation(() => {
      throw new Error("no git");
    });
  });

  afterEach(() => {
    dirs.forEach((d) => rmdirSync(d));
  });

  function addDir(): string {
    const d = makeTempDir();
    dirs.push(d);
    return d;
  }

  it("returns empty array when no projects exist", () => {
    expect(listProjects(db)).toEqual([]);
  });

  it("returns all active projects", () => {
    addProject(addDir(), db);
    addProject(addDir(), db);
    expect(listProjects(db)).toHaveLength(2);
  });

  it("excludes soft-deleted projects", () => {
    const p = addProject(addDir(), db);
    addProject(addDir(), db);
    removeProject(p.id, db);
    expect(listProjects(db)).toHaveLength(1);
  });
});

describe("removeProject", () => {
  let db: ReturnType<typeof createTestDb>;
  let tempDir: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = makeTempDir();
    mockExecSync.mockImplementation(() => {
      throw new Error("no git");
    });
  });

  afterEach(() => {
    rmdirSync(tempDir);
  });

  it("soft-deletes by setting removed_at", () => {
    const p = addProject(tempDir, db);
    expect(p.removedAt).toBeNull();
    removeProject(p.id, db);
    const listed = listProjects(db);
    expect(listed).toHaveLength(0);
  });

  it("is a no-op for an unknown id (does not throw)", () => {
    expect(() => removeProject("nonexistent-id", db)).not.toThrow();
  });
});
