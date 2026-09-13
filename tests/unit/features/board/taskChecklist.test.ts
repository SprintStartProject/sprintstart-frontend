import { describe, it, expect } from "vitest";
import {
  MAX_TASK_ITEMS,
  checklistFromTask,
  taskSteps,
} from "../../../../src/features/board/generation/taskChecklist";

/** The items, once it is settled that there are any. Keeps the assertions off a nullable. */
function items(task: Parameters<typeof checklistFromTask>[0]): string[] {
  const request = checklistFromTask(task);
  expect(request?.kind).toBe("CHECKLIST");

  return request?.kind === "CHECKLIST" ? request.items.map((item) => item.text) : [];
}

/**
 * What a task becomes on the hire's own board — and when it becomes nothing.
 *
 * The second half is the design: a task that states no steps has nothing to break down, and the
 * card this used to make was the task's own title handed back with a checkbox beside it.
 */
describe("checklistFromTask", () => {
  it("takes its title from the task", () => {
    const request = checklistFromTask({
      title: "Fix the login redirect",
      summary: "- Reproduce it locally",
    });

    expect(request).toMatchObject({ kind: "CHECKLIST", title: "Fix the login redirect" });
  });

  describe("a task that states its steps", () => {
    it("makes each checklist line an item", () => {
      expect(
        items({
          title: "Fix the login redirect",
          summary: "Steps:\n- [ ] Reproduce it locally\n- [ ] Add a failing test\n- [ ] Fix it",
        }),
      ).toEqual(["Reproduce it locally", "Add a failing test", "Fix it"]);
    });

    /**
     * Acceptance criteria and checklist items are both lists of things that have to be true, and
     * they sit under different headings — taking only the longest block would drop half the task.
     */
    it("takes every list in the body, not only the longest one", () => {
      expect(
        items({
          title: "Fix the login redirect",
          summary:
            "## Steps\n- Reproduce it locally\n\n## Acceptance Criteria\n" +
            "- [ ] The redirect keeps the query string\n- [ ] A test covers it",
        }),
      ).toEqual([
        "Reproduce it locally",
        "The redirect keeps the query string",
        "A test covers it",
      ]);
    });

    /** Every line on the card is a line the hire can find in the task — nothing is generated. */
    it("strips markdown rather than rewriting the line", () => {
      expect(
        items({
          title: "Fix it",
          summary: "- Run `npm run try`\n- Read the [runbook](https://example.test/runbook)",
        }),
      ).toEqual(["Run npm run try", "Read the runbook"]);
    });

    it("stops at the cap rather than making a card nobody scrolls", () => {
      const summary = Array.from({ length: MAX_TASK_ITEMS + 10 }, (_, i) => `- step ${i}`).join(
        "\n",
      );

      expect(items({ title: "Big one", summary })).toHaveLength(MAX_TASK_ITEMS);
    });

    /** The server mints ids, so two tabs adding a line cannot mint the same one. */
    it("sends no item ids", () => {
      const request = checklistFromTask({ title: "Fix it", summary: "- a\n- b" });

      expect(request?.kind === "CHECKLIST" && request.items.every((i) => !("id" in i))).toBe(true);
    });
  });

  /**
   * A new hire looking at "Fix the login redirect" with a checkbox beside it has been handed the
   * title back. The steps for a task that states none are the mentor's to write.
   */
  describe("a task that states none", () => {
    it("makes no card out of prose", () => {
      expect(
        checklistFromTask({
          title: "Fix the login redirect",
          summary: "The redirect drops the query string when the session has expired.",
        }),
      ).toBeNull();
    });

    it("makes no card out of a task with no body at all", () => {
      expect(checklistFromTask({ title: "Fix the login redirect", summary: null })).toBeNull();
    });
  });
});

/** The predicate the cards ask before deciding which offer to show. */
describe("taskSteps", () => {
  it("is empty for a task that states none", () => {
    expect(taskSteps({ title: "Fix it", summary: "Some prose about the bug." })).toEqual([]);
  });

  it("is the stated steps, in the order the task states them", () => {
    expect(taskSteps({ title: "Fix it", summary: "- second thing\n- first thing" })).toEqual([
      "second thing",
      "first thing",
    ]);
  });
});
