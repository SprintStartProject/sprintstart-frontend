/**
 * J14 — Edit profile and settings (docs/testing/e2e-journeys.md).
 *
 * The profile is saved to the backend (`PATCH /api/v1/users/me`), so a reload has to read the new name
 * back from it; the theme lives in the browser, so a reload has to keep it there. The admin account is
 * the one edited, because no other journey reads its name.
 */
import { expect, test, type Page } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

test.use({ storageState: storageStateOf("admin") });

async function openSection(page: Page, name: string): Promise<void> {
  await page.goto("/settings");
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name })
    .click();
}

async function saveLastName(page: Page, lastName: string): Promise<void> {
  await page.getByLabel("Last Name").fill(lastName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
}

test("a changed name is saved and read back after a reload", async ({ page }) => {
  await openSection(page, "User Profile");
  const lastName = `E2E ${crypto.randomUUID().slice(0, 6)}`;

  await saveLastName(page, lastName);
  await page.reload();
  await expect(page.getByLabel("Last Name")).toHaveValue(lastName);

  await saveLastName(page, "E2E");
});

test("a chosen theme is applied and kept after a reload", async ({ page }) => {
  await openSection(page, "Appearance");
  const html = page.locator("html");

  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("radio", { name: "Light" }).click();
  await expect(html).toHaveClass(/\blight\b/);
});
