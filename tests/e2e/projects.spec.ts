import { test, expect } from "@playwright/test";
import { mkdirSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeTempDir(): string {
  const dir = join(tmpdir(), `chaos-e2e-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Locates the project row for a given directory path. */
function projectRow(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never, dir: string) {
  return page.locator(`[data-testid="project-row"][data-dir="${dir}"]`);
}

test.describe("project management", () => {
  let tempDir: string;

  test.beforeEach(() => {
    tempDir = makeTempDir();
  });

  test.afterEach(() => {
    try { rmdirSync(tempDir); } catch { /* best effort */ }
  });

  test("adds a project by directory path and shows it in the list", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Project directory path").fill(tempDir);
    await page.getByRole("button", { name: "Add Project" }).click();

    const row = projectRow(page, tempDir);
    await expect(row).toBeVisible();
    await expect(row.getByText(tempDir)).toBeVisible();
  });

  test("shows an error for a non-existent directory", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Project directory path").fill("/nonexistent/path/abc123");
    await page.getByRole("button", { name: "Add Project" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("removes a project after double-check confirm", async ({ page }) => {
    await page.goto("/");

    // Add
    await page.getByLabel("Project directory path").fill(tempDir);
    await page.getByRole("button", { name: "Add Project" }).click();
    const row = projectRow(page, tempDir);
    await expect(row).toBeVisible();

    // First click: label changes to "Confirm?"
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(row.getByRole("button", { name: "Confirm?" })).toBeVisible();

    // Second click: submits, row disappears
    await row.getByRole("button", { name: "Confirm?" }).click();
    await expect(row).not.toBeVisible();
  });

  test("auto-resets after 5 seconds without confirmation", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Project directory path").fill(tempDir);
    await page.getByRole("button", { name: "Add Project" }).click();
    const row = projectRow(page, tempDir);
    await expect(row).toBeVisible();

    // First click
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(row.getByRole("button", { name: "Confirm?" })).toBeVisible();

    // Wait 5 s — label reverts
    await page.waitForTimeout(5100);
    await expect(row.getByRole("button", { name: "Remove" })).toBeVisible();
    await expect(row).toBeVisible();
  });
});
