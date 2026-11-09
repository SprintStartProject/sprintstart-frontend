/**
 * J05 — Ask the buddy a question and read the answer (docs/testing/e2e-journeys.md).
 *
 * The whole way runs for real — frontend, backend, its agent loop and persistence — up to the AI, which
 * e2e/ai-stub answers with contract-shaped events. The cited source is the deploy guide e2e/seed.ts
 * uploads: the stub cites the artifact the backend ingested, and the backend resolves it back to the
 * upload, so the drawer shows the document's own text.
 */
import { expect, test } from "@playwright/test";
import answers from "../ai-stub/answers.json" with { type: "json" };
import { DEPLOY_GUIDE, storageStateOf } from "../stack.ts";

const { answer: ANSWER, cited: CITED, greeting: GREETING } = answers;

test.use({ storageState: storageStateOf("hire") });

test("the buddy greets the hire when they open it", async ({ page }) => {
  await page.goto("/buddy");

  await expect(page.getByText(GREETING)).toBeVisible();
});

test("a question is answered and stays in the conversation after a reload", async ({ page }) => {
  await page.goto("/buddy");
  await expect(page.getByText(GREETING)).toBeVisible();

  // The stack keeps its data between runs, so the question is unique to this run.
  const question = `How do we deploy? (${crypto.randomUUID().slice(0, 8)})`;
  await page.getByPlaceholder("Ask your buddy anything...").fill(question);
  await page.keyboard.press("Enter");

  await expect(page.getByText(ANSWER).last()).toBeVisible();
  await page.reload();
  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByText(ANSWER).last()).toBeVisible();
});

test("an answer names its source, and the source opens with its own text", async ({ page }) => {
  await page.goto("/buddy");
  await expect(page.getByText(GREETING)).toBeVisible();

  const question = `Where is the deploy guide? Show me the source. (${crypto.randomUUID().slice(0, 8)})`;
  await page.getByPlaceholder("Ask your buddy anything...").fill(question);
  await page.keyboard.press("Enter");

  await expect(page.getByText(CITED).last()).toBeVisible();
  await page
    .getByRole("button", { name: /^Sources · 1/ })
    .last()
    .click();
  await page.getByRole("button", { name: DEPLOY_GUIDE.filename }).last().click();
  await page.getByRole("button", { name: "Open source" }).click();

  await expect(page.getByText("Releases are cut from the release branch")).toBeVisible();
});
