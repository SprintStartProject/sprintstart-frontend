/**
 * J13 — Manage team members and roles (docs/testing/e2e-journeys.md).
 *
 * The PM creates a role on the E2E project and gives it to the second hire. The role and its member
 * are read again after a reload, so both have to come back from the backend. The second hire is the
 * one assigned, because no other journey looks at their roles.
 */
import { expect, test, type Page } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

test.use({ storageState: storageStateOf("pm") });

async function openRoles(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: /PM\s*Dashboard/ }).click();
  await page.getByRole("button", { name: /^Team/ }).click();
  // Named "Roles 1" once a role exists, so matched by its start.
  await page.getByRole("button", { name: /^Roles/ }).click();
}

test("the PM creates a role and gives it to a member", async ({ page }) => {
  // The stack keeps its data between runs, so the role is unique to this run.
  const role = `E2E Role ${crypto.randomUUID().slice(0, 8)}`;
  await openRoles(page);

  await page.getByRole("button", { name: "New role" }).click();
  await page.getByLabel("Name", { exact: true }).fill(role);
  await page.getByLabel("Description").fill("Created by the end-to-end journey");
  await page.getByRole("button", { name: "Create role" }).click();
  // A new role opens on its own, so its row now offers to close it.
  await expect(page.getByText("Role created")).toBeVisible();
  await expect(page.getByRole("button", { name: `Close ${role}` })).toBeVisible();

  // The checkbox itself is visually hidden behind a custom box; its row is what a user clicks.
  await page.locator("label").filter({ hasText: "Kai E2E" }).click();
  await expect(page.getByRole("checkbox", { name: /Kai E2E/ })).toBeChecked();
  await page.getByRole("button", { name: "Save 1 change" }).click();
  await expect(page.getByText("Members updated")).toBeVisible();

  // openRoles loads the app afresh; a reload before it would race its navigation.
  await openRoles(page);
  await page.getByRole("button", { name: `Manage skills and members of ${role}` }).click();
  await expect(page.getByRole("checkbox", { name: /Kai E2E/ })).toBeChecked();
});
