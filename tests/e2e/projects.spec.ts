import { test, expect } from "@playwright/test";

test.describe("project discovery", () => {
  test("home page shows auto-discovered projects", async ({ page }) => {
    await page.goto("/");

    // The page should load and show the Projects heading
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // Projects from ~/.claude/projects/ should appear (or empty state)
    const rows = page.locator("[data-testid='project-row']");
    const emptyState = page.getByText("No projects found");

    // One or the other should be present
    const hasRows = await rows.count().then((c) => c > 0);
    if (!hasRows) {
      await expect(emptyState).toBeVisible();
    }
  });

  test("project rows link to project detail pages", async ({ page }) => {
    await page.goto("/");

    const rows = page.locator("[data-testid='project-row']");
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // First project row should be a link to its detail page
    const firstRow = rows.first();
    const href = await firstRow.getAttribute("href");
    expect(href).toMatch(/^\/projects\//);

    // Click and verify we land on the project detail page
    await firstRow.click();
    await expect(page.getByText("← Projects")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Running Agents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
  });
});
