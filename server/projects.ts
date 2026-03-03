import { execSync } from "child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseRemoteUrl } from "./git.js";
import { readCwd, listLogFiles } from "./logs.js";

export interface Project {
  encodedDir: string;
  directory: string;
  name: string;
  remoteUrl: string | null;
  providerType: "github" | "azure-devops" | null;
  owner: string | null;
  repo: string | null;
}

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

/**
 * Resolve the real directory path for a Claude projects subdirectory.
 * Reads the `cwd` field from the first JSONL file that has one.
 */
function resolveDirectory(encodedDir: string): string | null {
  const logDir = path.join(os.homedir(), ".claude", "projects", encodedDir);
  const files = listLogFiles(logDir);
  for (const file of files) {
    const cwd = readCwd(file);
    if (cwd) return cwd;
  }
  return null;
}

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  projects: Project[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10_000;
let cache: CacheEntry | null = null;

export function clearProjectCache(): void {
  cache = null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan ~/.claude/projects/ for subdirectories and build Project list.
 * Caches results with a short TTL.
 */
export function listProjects(): Project[] {
  if (cache && Date.now() < cache.expiresAt) return cache.projects;

  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const encodedDir = entry.name;

    const directory = resolveDirectory(encodedDir);
    if (!directory) continue;

    const remoteUrl = getRemoteUrl(directory);
    const remoteInfo = remoteUrl ? parseRemoteUrl(remoteUrl) : null;
    const name = remoteInfo
      ? `${remoteInfo.owner}/${remoteInfo.repo}`
      : path.basename(directory);

    results.push({
      encodedDir,
      directory,
      name,
      remoteUrl,
      providerType: remoteInfo?.providerType ?? null,
      owner: remoteInfo?.owner ?? null,
      repo: remoteInfo?.repo ?? null,
    });
  }

  cache = { projects: results, expiresAt: Date.now() + CACHE_TTL_MS };
  return results;
}

/** Get a single project by its encoded directory name. */
export function getProject(encodedDir: string): Project | undefined {
  return listProjects().find((p) => p.encodedDir === encodedDir);
}
