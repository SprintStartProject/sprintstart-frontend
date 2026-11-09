/**
 * J02 — Add a source document; it is ingested and becomes searchable (docs/testing/e2e-journeys.md).
 *
 * The PM uploads a file through Data Ingestion. The backend stores it and hands it to the AI service
 * (`/ingest/sync`, answered by e2e/ai-stub); the knowledge base then shows it with the AI's index
 * status (`/ingest/status`). Ingestion runs in the background, so the knowledge base is reloaded until
 * the status arrives.
 */
import { expect, test } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

test.use({ storageState: storageStateOf("pm") });

// The reload loops below wait for work the backend does in the background; the default 30 s
// would end them first.
test.setTimeout(120_000);

test("an uploaded document shows up in the knowledge base as indexed", async ({ page }) => {
  // The stack keeps its data between runs, so the file is unique to this run.
  const filename = `e2e-onboarding-notes-${crypto.randomUUID().slice(0, 8)}.md`;
  await page.goto("/data-ingestion");

  await page.getByRole("button", { name: "Add sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Upload/ }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: "text/markdown",
    buffer: Buffer.from("# Onboarding notes\n\nAsk in #help when the build breaks.\n"),
  });
  await expect(dialog.getByText(filename)).toBeVisible();
  await dialog.getByRole("button", { name: "Connect now" }).click();
  // An upload connects at once, so the dialog closes by itself.
  await expect(dialog).toBeHidden();

  const card = page.getByTestId("artifact-card").filter({ hasText: filename });
  await expect(async () => {
    await page.goto("/knowledge-base");
    await expect(card.getByText("Indexed", { exact: true })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
});
