/**
 * J10 — Set up a new hire: the arrival steps a PM prepares (docs/testing/e2e-journeys.md).
 *
 * The PM adds a custom step, finds it again after a reload, and removes it. The hire's side — the
 * arrival card on their board — needs a generated board, which the AI stub cannot produce, so it is
 * not covered here.
 */
import { expect, test } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

test.use({ storageState: storageStateOf("pm") });

test("the PM adds an arrival step, finds it after a reload, and removes it", async ({ page }) => {
  // The stack keeps its data between runs, so the step is unique to this run.
  const title = `Collect a laptop ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/hire-setup?tab=arrival");

  await page.getByRole("button", { name: "Add step" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Custom/ }).click();
  await dialog.getByPlaceholder("Request VPN access").fill(title);
  await dialog.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.reload();
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole("button", { name: `Edit "${title}"` }).click();
  await page.getByRole("button", { name: "Remove step" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
