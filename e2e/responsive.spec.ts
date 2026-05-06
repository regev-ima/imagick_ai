import { test, expect, devices } from "@playwright/test";

// Smoke checks on a phone viewport so we don't ship pages that overflow
// or hide their primary CTA on mobile. Uses Playwright's built-in
// iPhone 12 emulation profile.

test.use({ ...devices["iPhone 12"] });

test.describe("mobile viewport", () => {
  test("auth page primary CTA is visible without horizontal scroll", async ({ page }) => {
    await page.goto("/auth");
    const cta = page.getByRole("button", { name: /^sign in$/i }).first();
    await expect(cta).toBeVisible();

    // Body should not exceed the viewport width (no horizontal scrollbar)
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewport = page.viewportSize();
    expect(docWidth).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });

  test("legal page reads cleanly on phone", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
    await expect(page.getByText(/draft.*pending legal review/i)).toBeVisible();

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewport = page.viewportSize();
    expect(docWidth).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });

  test("404 page renders on phone", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-zzz");
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
