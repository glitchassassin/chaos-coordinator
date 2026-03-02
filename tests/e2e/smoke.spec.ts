import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Chaos Coordinator/);
  await expect(page.getByRole("heading", { name: "Chaos Coordinator" })).toBeVisible();
});
