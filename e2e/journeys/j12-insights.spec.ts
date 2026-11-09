/**
 * J12 — Read FAQ, knowledge gaps and onboarding insights (docs/testing/e2e-journeys.md): the FAQ
 * and the knowledge gaps.
 *
 * Every question a hire asks the buddy is classified by the AI service and filed into the project's
 * FAQ (`/insights/faq/classify`, answered by e2e/ai-stub with an entry titled after the question).
 * The PM then reads it under Questions. Filing runs after the answer, so the page is reloaded until
 * the entry is there. A scan of the knowledge gaps asks the AI service to classify the corpus
 * (`/insights/knowledge-gaps/detect`, answered by the stub with one fixed gap), and the backend stores
 * and serves what it got.
 */
import { expect, test } from "@playwright/test";
import { storageStateOf } from "../stack.ts";

// The reload loops below wait for work the backend does in the background; the default 30 s
// would end them first.
test.setTimeout(120_000);

test("a hire's question shows up in the PM's FAQ", async ({ browser }) => {
  // The stack keeps its data between runs, so the question is unique to this run.
  const question = `How do I get access to the staging database? (${crypto.randomUUID().slice(0, 8)})`;
  const hire = await (await browser.newContext({ storageState: storageStateOf("hire") })).newPage();
  await hire.goto("/buddy");
  await hire.getByPlaceholder("Ask your buddy anything...").fill(question);
  await hire.keyboard.press("Enter");
  await expect(hire.getByText(question)).toBeVisible();

  const pm = await (await browser.newContext({ storageState: storageStateOf("pm") })).newPage();
  await expect(async () => {
    await pm.goto("/");
    await pm.getByRole("link", { name: /PM\s*Dashboard/ }).click();
    await pm.getByRole("button", { name: /^Questions/ }).click();
    // The entry is titled after the question and shows it again as its sample question.
    await expect(pm.getByText(question).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
});

test("a scan shows the knowledge gap the AI found", async ({ browser }) => {
  const pm = await (await browser.newContext({ storageState: storageStateOf("pm") })).newPage();
  // The backend rescans by itself once newly uploaded documentation is indexed, and the seed
  // uploads some, so a scan may already be running; otherwise the PM starts one.
  await expect(async () => {
    await pm.goto("/");
    await pm.getByRole("link", { name: /PM\s*Dashboard/ }).click();
    await pm.getByRole("button", { name: /^Knowledge gaps/ }).click();
    const rescan = pm.getByRole("button", { name: "Rescan now" });
    if (await rescan.isEnabled().catch(() => false)) await rescan.click();
    await expect(pm.getByText("deploy-pipeline").first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 120_000 });
});
