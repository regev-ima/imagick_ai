import { test, expect } from "@playwright/test";

// Client-side form behaviour for /auth. No Supabase calls are exercised
// — these tests guard the toggles, validation, and password-strength UI.

test.describe("auth form interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("defaults to sign-in mode (no Full Name field)", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^sign in$/i }).first()).toBeVisible();
    // Full Name field should NOT be visible in sign-in mode
    await expect(page.getByLabel(/full name/i)).toHaveCount(0);
  });

  test("toggles to sign-up mode and reveals the Full Name field", async ({ page }) => {
    await page.getByRole("button", { name: /^sign up$/i }).click();
    await expect(page.getByRole("button", { name: /start for free/i })).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
  });

  test("shows password strength indicator when typing in sign-up mode", async ({ page }) => {
    await page.getByRole("button", { name: /^sign up$/i }).click();
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("a");
    // Strength meter renders — the underlying component shows requirement text
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("shows the forgot-password screen and lets you go back", async ({ page }) => {
    await page.getByRole("button", { name: /forgot password/i }).click();
    await expect(page.getByRole("button", { name: /send reset email/i })).toBeVisible();

    await page.getByRole("button", { name: /back to sign in/i }).click();
    await expect(page.getByRole("button", { name: /^sign in$/i }).first()).toBeVisible();
  });

  test("Google sign-in button is visible on both login and signup", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
    await page.getByRole("button", { name: /^sign up$/i }).click();
    await expect(page.getByRole("button", { name: /sign up with google/i })).toBeVisible();
  });

  test("password field has minLength=8 attribute (browser validation)", async ({ page }) => {
    await page.getByRole("button", { name: /^sign up$/i }).click();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  test("legal links from auth page navigate to in-app legal pages", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacy/i }).first();
    const termsLink = page.getByRole("link", { name: /terms/i }).first();
    if (await privacyLink.count()) {
      await expect(privacyLink).toHaveAttribute("href", /\/legal\/privacy$/);
    }
    if (await termsLink.count()) {
      await expect(termsLink).toHaveAttribute("href", /\/legal\/terms$/);
    }
  });
});
