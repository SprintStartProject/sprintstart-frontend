/** Signs a user in the way a person does: the app's SSO button, then Keycloak's login form. */
import { expect, type Page } from "@playwright/test";
import { APP_URL, PASSWORD, type E2eUser } from "./stack.ts";

export async function signIn(page: Page, user: E2eUser): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  await page
    .getByLabel(/username|email/i)
    .first()
    .fill(user.username);
  await page
    .getByLabel(/^password/i)
    .first()
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: /sign in|log in/i })
    .first()
    .click();
  await page.waitForURL(`${APP_URL}/**`);
  await expect(page.getByRole("heading", { name: new RegExp(user.firstName) })).toBeVisible();
}
