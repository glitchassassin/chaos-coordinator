import { readFileSync, watchFile } from "node:fs";
import { resolve } from "node:path";

export interface Instance {
  id: string;
  name: string;
  port: number;
  directory: string;
}

const INSTANCES_PATH = resolve(process.cwd(), "instances.json");

let instances: Instance[] = [];

function load(): void {
  try {
    const raw = readFileSync(INSTANCES_PATH, "utf-8");
    instances = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load instances.json: ${e}`);
    instances = [];
  }
}

export function initInstances(): void {
  load();
  watchFile(INSTANCES_PATH, { interval: 2000 }, () => {
    console.log("instances.json changed, reloading...");
    load();
  });
}

export function getInstances(): Instance[] {
  return instances;
}

export function getInstance(id: string): Instance | undefined {
  return instances.find((i) => i.id === id);
}
