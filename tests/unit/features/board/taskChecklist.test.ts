import { describe, it, expect } from "vitest";
import {
  MAX_TASK_ITEMS,
  checklistFromTask,
} from "../../../../src/features/board/generation/taskChecklist";

/**
 * What a task becomes on the hire's own board.
 *
 * The two branches are the whole design: a task that says what its steps are contributes them, and
 * a task that says nothing still becomes something tickable rather than nothing at all.
 */
describe("checklistFromTask", () => {
  it("takes its title from the task", () => {
    const request = checklistFromTask({ title: "Fix the login redirect" });

    expect(request).toMatchObject({ kind: "CHECKLIST", title: "Fix the login redirect" });
  });

  describe("a task with structure", () => {
    it("makes each checklist line an item", () => {
      const request = checklistFromTask({
        title: "Fix the login redirect",
        summary: "Steps:\n- [ ] Reproduce it locally\n- [ ] Add a failing test\n- [ ] Fix it",
      });

      expect(request).toMatchObject({
        items: [
          { text: "Reproduce it locally", done: false },
          { text: "Add a failing test", done: false },
          { text: "Fix it", done: false },
        ],
      });
    });

    /**
     * Acceptance criteria and checklist items are both lists of things that have to be true, and
     * they sit under different headings — taking only the longest block would drop half the task.
     */
    it("takes every list in the body, not only the longest one", () => {
      const request = checklistFromTask({
        title: "Fix the login redirect",
        summary:
          "## Steps\n- Reproduce it locally\n\n## Acceptance Criteria\n" +
          "- [ ] The redirect keeps the query string\n- [ ] A test covers it",
      });

      expect(request.kind === "CHECKLIST" && request.items.map((item) => item.text)).toEqual([
        "Reproduce it locally",
        "The redirect keeps the query string",
        "A test covers it",
      ]);
    });

    /** Every line on the card is a line the hire can find in the task — nothing is generated. */
    it("strips markdown rather than rewriting the line", () => {
      const request = checklistFromTask({
        title: "Fix it",
        summary: "- Run `npm run try`\n- Read the [runbook](https://example.test/runbook)",
      });

      expect(request.kind === "CHECKLIST" && request.items.map((item) => item.text)).toEqual([
        "Run npm run try",
        "Read the runbook",
      ]);
    });

    it("stops at the cap rather than making a card nobody scrolls", () => {
      const summary = Array.from({ length: MAX_TASK_ITEMS + 10 }, (_, i) => `- step ${i}`).join(
        "\n",
      );

      const request = checklistFromTask({ title: "Big one", summary });

      expect(request.kind === "CHECKLIST" && request.items).toHaveLength(MAX_TASK_ITEMS);
    });
  });

  describe("a task with no structure", () => {
    /** One tickable thing on their board beats nothing on their board. */
    it("becomes a single item named after the task", () => {
      const request = checklistFromTask({
        title: "Fix the login redirect",
        summary: "The redirect drops the query string when the session has expired.",
      });

      expect(request).toMatchObject({
        items: [{ text: "Fix the login redirect", done: false }],
      });
    });

    it("handles a task with no body at all", () => {
      const request = checklistFromTask({ title: "Fix the login redirect", summary: null });

      expect(request).toMatchObject({ items: [{ text: "Fix the login redirect" }] });
    });
  });

  /** The server mints ids, so two tabs adding a line cannot mint the same one. */
  it("sends no item ids", () => {
    const request = checklistFromTask({ title: "Fix it", summary: "- a\n- b" });

    expect(request.kind === "CHECKLIST" && request.items.every((item) => !("id" in item))).toBe(
      true,
    );
  });
});
