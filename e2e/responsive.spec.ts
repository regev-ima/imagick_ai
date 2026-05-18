import { test, expect } from "@playwright/test";

// Smoke checks on a phone viewport so we don't ship pages that overflow
// or hide their primary CTA on mobile. We don't use Playwright's built-in
// `devices["iPhone 12"]` profile because it sets defaultBrowserType to
// webkit, which would force CI to install another browser. The viewport
// + isMobile flags are what we actually care about.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

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
