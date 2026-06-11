import { test, expect } from "@playwright/test";

// Smoke test for the internal design-concept route (/design-preview).
// The page is static mock data with a scoped stylesheet — this guards
// against the lazy chunk failing to load (e.g. a broken CSS import) or
// a runtime error blanking the route, so design reviews never happen
// against a silently broken render.

test.describe("design concept preview", () => {
  test("renders the AURA concept without thrown exceptions", async ({ page }) => {
    const thrown: string[] = [];
    page.on("pageerror", (e) => thrown.push(e.message));

    await page.goto("/design-preview");

    await expect(page.getByRole("heading", { name: "AURA" })).toBeVisible();
    // One representative element per major section.
    await expect(page.getByRole("heading", { name: /dashboard — talk to the studio/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /gallery — the living cull/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /design tokens/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /core components/i })).toBeVisible();

    expect(thrown).toEqual([]);
  });
});
