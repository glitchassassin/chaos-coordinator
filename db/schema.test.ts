import { describe, it, expect, beforeEach } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { createTestDb, type Db } from "./client.js";
import { projects, agents } from "./schema.js";

const id = () => crypto.randomUUID();

const testProject = () => ({
  id: id(),
  name: "Test Project",
  directory: `/tmp/test-${id()}`,
  createdAt: new Date().toISOString(),
});

describe("projects table", () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("inserts and queries a project", () => {
    const project = testProject();
    db.insert(projects).values(project).run();

    const rows = db.select().from(projects).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(project.id);
    expect(rows[0].name).toBe(project.name);
    expect(rows[0].directory).toBe(project.directory);
    expect(rows[0].removedAt).toBeNull();
  });

  it("stores optional fields", () => {
    const project = {
      ...testProject(),
      remoteUrl: "https://github.com/owner/repo",
      providerType: "github",
      owner: "owner",
      repo: "repo",
    };
    db.insert(projects).values(project).run();

    const row = db.select().from(projects).where(eq(projects.id, project.id)).get();
    expect(row?.remoteUrl).toBe(project.remoteUrl);
    expect(row?.providerType).toBe(project.providerType);
    expect(row?.owner).toBe(project.owner);
    expect(row?.repo).toBe(project.repo);
  });

  it("enforces UNIQUE constraint on directory", () => {
    const dir = `/tmp/unique-test-${id()}`;
    db.insert(projects).values({ ...testProject(), directory: dir }).run();
    expect(() =>
      db.insert(projects).values({ ...testProject(), directory: dir }).run()
    ).toThrow();
  });

  it("soft deletes by setting removed_at", () => {
    const project = testProject();
    db.insert(projects).values(project).run();

    const removedAt = new Date().toISOString();
    db.update(projects).set({ removedAt }).where(eq(projects.id, project.id)).run();

    const row = db.select().from(projects).where(eq(projects.id, project.id)).get();
    expect(row?.removedAt).toBe(removedAt);
  });

  it("filters out soft-deleted projects", () => {
    const active = testProject();
    const deleted = { ...testProject(), removedAt: new Date().toISOString() };
    db.insert(projects).values(active).run();
    db.insert(projects).values(deleted).run();

    const rows = db
      .select()
      .from(projects)
      .where(isNull(projects.removedAt))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(active.id);
  });
});

describe("agents table", () => {
  let db: Db;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = testProject();
    projectId = project.id;
    db.insert(projects).values(project).run();
  });

  const testAgent = (overrides?: Partial<typeof agents.$inferInsert>) => ({
    id: id(),
    projectId,
    tmuxSession: `orch-${id()}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it("inserts and queries an agent", () => {
    const agent = testAgent();
    db.insert(agents).values(agent).run();

    const rows = db.select().from(agents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(agent.id);
    expect(rows[0].projectId).toBe(projectId);
    expect(rows[0].status).toBe("starting");
  });

  it("stores optional fields", () => {
    const agent = testAgent({
      initialPrompt: "Fix the bug",
      linkedIssueId: "42",
      linkedPrId: "7",
      logPath: "/tmp/log.jsonl",
    });
    db.insert(agents).values(agent).run();

    const row = db.select().from(agents).where(eq(agents.id, agent.id)).get();
    expect(row?.initialPrompt).toBe("Fix the bug");
    expect(row?.linkedIssueId).toBe("42");
    expect(row?.linkedPrId).toBe("7");
    expect(row?.logPath).toBe("/tmp/log.jsonl");
  });

  it("enforces FK: project_id must reference a valid project", () => {
    expect(() =>
      db.insert(agents).values(testAgent({ projectId: "nonexistent" })).run()
    ).toThrow();
  });

  it("enforces UNIQUE constraint on tmux_session", () => {
    const session = `orch-${id()}`;
    db.insert(agents).values(testAgent({ tmuxSession: session })).run();
    expect(() =>
      db.insert(agents).values(testAgent({ tmuxSession: session })).run()
    ).toThrow();
  });

  it("updates status and ended_at on termination", () => {
    const agent = testAgent();
    db.insert(agents).values(agent).run();

    const endedAt = new Date().toISOString();
    db.update(agents)
      .set({ status: "terminated", endedAt })
      .where(eq(agents.id, agent.id))
      .run();

    const row = db.select().from(agents).where(eq(agents.id, agent.id)).get();
    expect(row?.status).toBe("terminated");
    expect(row?.endedAt).toBe(endedAt);
  });

  it("queries agents by project", () => {
    const otherProject = testProject();
    db.insert(projects).values(otherProject).run();

    db.insert(agents).values(testAgent()).run();
    db.insert(agents).values(testAgent()).run();
    db.insert(agents).values(testAgent({ projectId: otherProject.id })).run();

    const rows = db
      .select()
      .from(agents)
      .where(eq(agents.projectId, projectId))
      .all();

    expect(rows).toHaveLength(2);
  });
});
