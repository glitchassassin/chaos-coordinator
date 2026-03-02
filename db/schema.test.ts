import { describe, it, expect } from "vitest";
import { projects, agents } from "./schema";

describe("schema", () => {
  it("exports projects table", () => {
    expect(projects).toBeDefined();
  });

  it("exports agents table", () => {
    expect(agents).toBeDefined();
  });
});
