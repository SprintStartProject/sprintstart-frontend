/**
 * J11 — Create a project with the admin wizard (docs/testing/e2e-journeys.md).
 *
 * Details → members → sources, created without sources or members: a member assigned here would be
 * moved out of the E2E project the other journeys rely on. The project has to come back from the
 * backend, so it is looked for again after a reload.
 */
import { expect, test, type Page } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

test.use({ storageState: storageStateOf("admin") });

async function openProjects(page: Page): Promise<void> {
  await page.goto("/admin");
  await page
    .getByRole("group", { name: "Admin sections" })
    .getByRole("button", { name: "Projects" })
    .click();
}

test("the admin creates a project and finds it again after a reload", async ({ page }) => {
  // The stack keeps its data between runs, so the name is unique to this run.
  const name = `E2E Wizard ${crypto.randomUUID().slice(0, 8)}`;
  await openProjects(page);

  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create without sources" }).click();

  await openProjects(page);
  await expect(page.getByText(name)).toBeVisible();
});
