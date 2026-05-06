import { authedTest as test, expect } from "./fixtures";

// Dashboard render checks with a mocked Supabase session. These don't
// validate business logic — they make sure each route's lazy chunk loads,
// the auth gate accepts the seeded session, and there are no thrown
// exceptions during render. This is what catches things like a missing
// import after a refactor or a stray top-level access of an undefined
// supabase result.

const ROUTES_TO_RENDER = [
  { path: "/dashboard", expect: /dashboard|welcome|gallery/i },
  { path: "/dashboard/galleries", expect: /galleries|new gallery|create/i },
  { path: "/dashboard/styles", expect: /styles|new style/i },
  { path: "/dashboard/billing", expect: /billing|plan|subscription/i },
  { path: "/dashboard/settings", expect: /settings|profile|email/i },
];

for (const route of ROUTES_TO_RENDER) {
  test(`${route.path} renders for an authed user without thrown exceptions`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(route.path);
    // Wait for SPA to settle past the initial loading spinner
    await expect(page.locator("body")).toBeVisible();
    // Allow lazy chunk to load + auth state to resolve
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    expect(errors, `runtime exceptions on ${route.path}: ${errors.join("; ")}`).toEqual([]);
  });
}

test("authed user is NOT redirected from /dashboard to /auth", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  expect(page.url()).not.toMatch(/\/auth($|\?)/);
});

test("admin route redirects a non-admin authed user", async ({ page }) => {
  // Our seeded user has no admin role; AdminRoute should redirect away.
  await page.goto("/dashboard/admin");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // AdminRoute typically redirects to /dashboard. Accept either that or
  // a "not authorised" message — anything but the admin view itself.
  const url = page.url();
  const adminContent = await page.getByText(/admin dashboard/i).count();
  expect(adminContent === 0 || !url.includes("/admin")).toBe(true);
});
