import { readFileSync, writeFileSync, watchFile } from "node:fs";
import { resolve } from "node:path";

export interface Instance {
  id: string;
  name: string;
  port: number;
  directory: string;
  remote?: "github" | "azuredevops";
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

function save(): void {
  writeFileSync(INSTANCES_PATH, JSON.stringify(instances, null, 2) + "\n", "utf-8");
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

export function addInstance(instance: Instance): void {
  instances = [...instances, instance];
  save();
}

export function removeInstance(id: string): void {
  instances = instances.filter((i) => i.id !== id);
  save();
}
