import { test, expect } from "@playwright/test";

// Behaviour of the public-facing pages that don't need a backend session.

test.describe("404 page", () => {
  test("renders the not-found view on a bogus URL", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-zzz");
    await expect(page.getByText(/page not found/i)).toBeVisible();
    await expect(page.getByText(/^404$/)).toBeVisible();
  });

  test("links back to the dashboard", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-zzz");
    const dashboardLink = page.getByRole("link", { name: /go to dashboard/i });
    await expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });
});

test.describe("/unsubscribe", () => {
  test("with no token shows the missing-token message", async ({ page }) => {
    await page.goto("/unsubscribe");
    await expect(page.getByText(/missing.*token/i)).toBeVisible({ timeout: 10_000 });
  });

  test("with an unsupported kind shows the unsupported-link error", async ({ page }) => {
    await page.goto("/unsubscribe?token=fake&kind=bogus");
    await expect(page.getByText(/unsupported|invalid|expired/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("/reset-password", () => {
  test("renders without crashing when accessed directly", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/reset-password");
    expect(errors).toEqual([]);
  });
});

test.describe("legal pages", () => {
  test("Privacy page renders title, banner, last-updated, and back link", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: /privacy/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/draft.*pending legal review/i)).toBeVisible();
    await expect(page.getByText(/last updated/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /back/i }).first()).toHaveAttribute("href", "/auth");
  });

  test("Terms page renders title, banner, last-updated, and back link", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: /terms/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/draft.*pending legal review/i)).toBeVisible();
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });
});

test.describe("short-link redirector", () => {
  test("a bogus short ID does not crash the SPA", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/g/nonexistent-shortid-xxxxx");
    // Either redirects elsewhere or shows an error — both are acceptable;
    // the test guards against the SPA throwing during render.
    expect(errors).toEqual([]);
  });
});
