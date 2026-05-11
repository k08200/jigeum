import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays Jigeum hero with concept message", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "JIGEUM" })).toBeVisible();
    await expect(page.locator("h1")).toContainText("Stop checking apps");
    await expect(page.locator("h1")).toContainText("Clear decisions");
  });

  test("shows early access CTA", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('a:has-text("Request early access")').first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/early-access");
  });

  test("shows decision queue example", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Prepare investor follow-up" })).toBeVisible();
    await expect(page.getByText("Approval needed")).toBeVisible();
  });

  test("shows work graph and trust ladder sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Jigeum should show the shape/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Trust is a ladder/ })).toBeVisible();
  });

  test("no pricing section visible", async ({ page }) => {
    await page.goto("/");
    // Pricing was removed per concept-first approach
    await expect(page.locator("text=$29/mo")).not.toBeVisible();
  });
});
