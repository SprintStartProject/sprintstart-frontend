/** J01 — Sign in through Keycloak and land on the role's home page (docs/testing/e2e-journeys.md). */
import { expect, test } from "@playwright/test";
import { signIn } from "../sign-in.ts";
import { USERS, storageStateOf } from "../stack.ts";

test("a hire signs in and lands on their dashboard", async ({ page }) => {
  await signIn(page, USERS.hire);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("navigation").first().getByRole("link", { name: /Buddy/ }),
  ).toBeVisible();
});

test("a visitor who is not signed in is sent to the sign-in page", async ({ page }) => {
  await page.goto("/buddy");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Sign in with SSO" })).toBeVisible();
});

test("a project manager sees the project manager's area", async ({ page }) => {
  await signIn(page, USERS.pm);

  await expect(
    page
      .getByRole("navigation")
      .first()
      .getByRole("link", { name: /Team|PM|Project/i })
      .first(),
  ).toBeVisible();
});

test.describe("with a saved session", () => {
  test.use({ storageState: storageStateOf("pm") });

  test("a project manager opens the PM dashboard straight from a link", async ({ page }) => {
    // A bookmark or reload of a manager page used to land on the home page: the project list
    // counted as loaded in the render right after sign-in, before the manager's projects arrived.
    await page.goto("/pm-dashboard");

    await expect(page.getByRole("heading", { name: "PM Dashboard" })).toBeVisible();
    await expect(page).toHaveURL(/\/pm-dashboard$/);
  });
});
