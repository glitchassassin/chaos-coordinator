import { spawn, type ChildProcess } from "node:child_process";

interface ManagedProcess {
  id: string;
  pid: number;
  port: number;
  process: ChildProcess;
}

const managed = new Map<string, ManagedProcess>();
let nextPort = 4097; // 4096 reserved for static instances

export function getNextPort(): number {
  return nextPort++;
}

export function reservePort(port: number): void {
  if (port >= nextPort) {
    nextPort = port + 1;
  }
}

export function spawnInstance(id: string, directory: string, port: number): void {
  const child = spawn("opencode", ["serve", "--port", String(port)], {
    cwd: directory,
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("error", (err) => {
    console.error(`[process-manager] Failed to start opencode for ${id}:`, err);
  });

  child.on("exit", (code) => {
    console.log(`[process-manager] opencode for ${id} exited with code ${code}`);
    managed.delete(id);
  });

  managed.set(id, { id, pid: child.pid!, port, process: child });
  console.log(`[process-manager] Spawned opencode for ${id} (pid ${child.pid}) on port ${port}`);
}

export function killInstance(id: string): void {
  const entry = managed.get(id);
  if (!entry) return;
  entry.process.kill("SIGTERM");
  managed.delete(id);
  console.log(`[process-manager] Killed opencode for ${id}`);
}

export function killAll(): void {
  for (const [id] of managed) {
    killInstance(id);
  }
}

// Clean up on exit
process.on("exit", killAll);
process.on("SIGINT", () => { killAll(); process.exit(0); });
process.on("SIGTERM", () => { killAll(); process.exit(0); });
