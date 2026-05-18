/**
 * Test fixtures for Playwright E2E.
 *
 * Two extended `test`s:
 *
 *   - `test` (the default) — vanilla Playwright with no mocks. Use for
 *     pages that don't touch Supabase (legal, 404, /unsubscribe with bad
 *     token, etc.) and for client-side form-validation tests.
 *
 *   - `authedTest` — installs a mock Supabase auth session in
 *     localStorage and intercepts the auth + REST endpoints with canned
 *     responses, so dashboard pages can render without a real backend.
 *
 * Mocked endpoints aim to keep auth happy + return empty data for
 * everything else. If a specific test needs richer fake data, override
 * the route inside the test itself with `page.route(..., ...)`.
 */

import { test as base, expect, type Page } from "@playwright/test";

const SUPABASE_PROJECT_REF = "zfcltfqgrhytpvgqkkfo";
const SUPABASE_HOST = `${SUPABASE_PROJECT_REF}.supabase.co`;
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

export const FAKE_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test-user@imagick.test",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test User" },
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export function makeFakeSession() {
  // 1-hour ahead so the client doesn't try to refresh during the test.
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: "fake.jwt.token",
    refresh_token: "fake-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: FAKE_USER,
  };
}

/**
 * Intercept Supabase REST + auth requests with canned responses so the
 * page renders without a live backend. Empty-array defaults are usually
 * enough; override per-test where needed.
 */
export async function mockSupabase(page: Page) {
  // Auth: catch-all so any unexpected auth endpoint also gets stubbed.
  await page.route(`https://${SUPABASE_HOST}/auth/v1/**`, async (route) => {
    const url = route.request().url();

    if (url.includes("/auth/v1/logout")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (url.includes("/auth/v1/token")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeFakeSession()),
      });
      return;
    }
    if (url.includes("/auth/v1/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(FAKE_USER),
      });
      return;
    }
    // Sensible default for everything else (factors, settings, etc.)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // REST: empty array for any table query, null for RPCs
  await page.route(`https://${SUPABASE_HOST}/rest/v1/**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/rpc/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Content-Range": "0-0/0" },
      body: JSON.stringify([]),
    });
  });

  // Edge functions: 200 + empty object so fire-and-forget calls don't
  // surface as failed network requests in the test report.
  await page.route(`https://${SUPABASE_HOST}/functions/v1/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

/**
 * Seed the Supabase JS auth-token localStorage entry so `useAuth()`
 * hydrates as logged-in on first paint.
 */
export async function seedAuthSession(page: Page) {
  // Must be set BEFORE the SPA loads, so do it via initScript.
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(makeFakeSession()) },
  );
}

export const authedTest = base.extend({
  page: async ({ page }, use) => {
    await mockSupabase(page);
    await seedAuthSession(page);
    await use(page);
  },
});

export { expect };
