import { execSync } from "child_process";
import { existsSync, accessSync, constants } from "fs";
import { basename } from "path";
import { eq, isNull } from "drizzle-orm";
import { type Db, getDb } from "../db/client.js";
import { projects } from "../db/schema.js";
import { parseRemoteUrl } from "./git.js";

export type Project = typeof projects.$inferSelect;

function getRemoteUrl(directory: string): string | null {
  try {
    const out = execSync(`git -C "${directory}" remote get-url origin`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function addProject(directory: string, db: Db = getDb()): Project {
  if (!existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }
  try {
    accessSync(directory, constants.R_OK);
  } catch {
    throw new Error(`Directory not accessible: ${directory}`);
  }

  const remoteUrl = getRemoteUrl(directory);
  const remoteInfo = remoteUrl ? parseRemoteUrl(remoteUrl) : null;
  const name = remoteInfo ? `${remoteInfo.owner}/${remoteInfo.repo}` : basename(directory);

  const id = crypto.randomUUID();
  db.insert(projects)
    .values({
      id,
      name,
      directory,
      remoteUrl,
      providerType: remoteInfo?.providerType ?? null,
      owner: remoteInfo?.owner ?? null,
      repo: remoteInfo?.repo ?? null,
    })
    .run();

  return db.select().from(projects).where(eq(projects.id, id)).get()!;
}

export function listProjects(db: Db = getDb()): Project[] {
  return db.select().from(projects).where(isNull(projects.removedAt)).all();
}

export function removeProject(id: string, db: Db = getDb()): void {
  const removedAt = new Date().toISOString();
  db.update(projects).set({ removedAt }).where(eq(projects.id, id)).run();
}
