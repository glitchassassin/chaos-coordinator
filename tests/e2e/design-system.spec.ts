import { test, expect } from "@playwright/test";

test.describe("design system page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-system");
  });

  test("renders all color roles", async ({ page }) => {
    const roles = ["Text", "Secondary", "Border", "Background", "Active", "Waiting", "Error", "Link / Action"];
    for (const role of roles) {
      await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    }
  });

  test("renders syntax token table", async ({ page }) => {
    const tokens = ["Keyword", "String", "Comment", "Number", "Function", "Operator", "Type"];
    for (const token of tokens) {
      await expect(page.getByText(token, { exact: true }).first()).toBeVisible();
    }
  });

  test("renders interactive elements with sufficient size", async ({ page }) => {
    const button = page.getByRole("button", { name: "Button (44px tall)" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);

    const input = page.getByPlaceholder("Text input (44px tall)");
    await expect(input).toBeVisible();
    const inputBox = await input.boundingBox();
    expect(inputBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("has no CSS animations or transitions", async ({ page }) => {
    const hasAnimations = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      return elements.some((el) => {
        const style = getComputedStyle(el);
        return (
          parseFloat(style.animationDuration) > 0 ||
          parseFloat(style.transitionDuration) > 0
        );
      });
    });
    expect(hasAnimations).toBe(false);
  });

  test("shows sidebar navigation", async ({ page }) => {
    const sidebar = page.locator(".app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole("link", { name: "Colors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Typography" })).toBeVisible();
  });

  test("sidebar stacks above main on narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const navBox = await page.locator(".app-sidebar").boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();
    // Sidebar should appear above main (lower y value)
    expect(navBox?.y).toBeLessThan(mainBox?.y ?? Infinity);
  });

  test("sidebar appears to the left of main on wide viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const navBox = await page.locator(".app-sidebar").boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();
    // Sidebar should be to the left of main
    expect(navBox?.x).toBeLessThan(mainBox?.x ?? Infinity);
  });
});
