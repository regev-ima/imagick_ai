import { test, expect } from "@playwright/test";

// Smoke tests for the auth gate. These verify that the SPA shell loads
// without runtime errors and that protected routes redirect anonymous
// users instead of leaking dashboard content. Sign-up / payment flows
// are intentionally NOT exercised here because they touch live PayPal
// and Resend; we cover them with manual end-to-end tests.

test.describe("public-facing routes", () => {
  test("landing page loads without thrown exceptions", async ({ page }) => {
    const thrown: string[] = [];
    page.on("pageerror", (e) => thrown.push(e.message));

    await page.goto("/");
    await expect(page).toHaveTitle(/imagick/i);

    // Console.error is too noisy in dev (Sentry init, network 401s for
    // anon Supabase calls). pageerror catches real uncaught exceptions
    // — those are the regressions we actually want to block on.
    expect(thrown).toEqual([]);
  });

  test("auth page renders the sign-in form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("button", { name: /sign in|log in|continue/i }).first()).toBeVisible();
  });

  test("dashboard redirects anonymous users to /auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("legal pages render with the draft banner", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByText(/draft.*pending legal review/i)).toBeVisible();

    await page.goto("/legal/terms");
    await expect(page.getByText(/draft.*pending legal review/i)).toBeVisible();
  });
});
