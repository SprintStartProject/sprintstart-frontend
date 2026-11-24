/** J09 — Talk to the buddy in team mode about a managed project (docs/testing/e2e-journeys.md). */
import { expect, test } from "@playwright/test";
import answers from "../ai-stub/answers.json" with { type: "json" };
import { userToken } from "../seed.ts";
import { BACKEND_URL, PROJECT_NAME, USERS, storageStateOf } from "../stack.ts";

async function projectId(): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/v1/admin/projects`, {
    headers: { Authorization: `Bearer ${await userToken(USERS.admin)}` },
  });
  const projects = (await response.json()) as { id: string; name: string }[];
  return projects.find((project) => project.name === PROJECT_NAME)!.id;
}

test.describe("as the project's manager", () => {
  test.use({ storageState: storageStateOf("pm") });

  test("the manager switches the buddy to the team and gets an answer there", async ({ page }) => {
    await page.goto("/buddy");

    await page.getByTestId("buddy-mode-switcher").click();
    await page.getByRole("option", { name: new RegExp(PROJECT_NAME) }).click();
    await expect(page.getByText(answers.greeting).last()).toBeVisible();
    // The stack keeps its data between runs, so the question is unique to this run.
    const question = `Who needs my attention? (${crypto.randomUUID().slice(0, 8)})`;
    await page.getByPlaceholder(/Ask your buddy/).fill(question);
    await page.keyboard.press("Enter");

    await expect(page.getByText(question)).toBeVisible();
    await expect(page.getByText(answers.answer).last()).toBeVisible();
  });
});

test("a hire who does not manage the project is refused team mode", async () => {
  const query = new URLSearchParams({ teamProjectId: await projectId() });
  const response = await fetch(
    `${BACKEND_URL}/api/v1/onboarding/me/buddy/messages?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${await userToken(USERS.hire)}` },
    },
  );

  expect(response.status).toBe(403);
});
