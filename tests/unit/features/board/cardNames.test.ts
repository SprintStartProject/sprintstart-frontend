import { describe, expect, it } from "vitest";
import { cardName, readableTitle } from "../../../../src/features/board/layout/cardNames";
import { PATH_STEP_FALLBACK_TITLE, type BoardCard } from "../../../../src/features/board/types";

// The invisible marks the retired path generator wrote, spelled out so the test can be read.
const STEP_MARK = String.fromCharCode(0x2063);
const BLUEPRINT_MARK = String.fromCharCode(0x2060);

const card = (content: Record<string, unknown>) => ({ content }) as unknown as BoardCard;

describe("readableTitle", () => {
  it("takes off the marks the retired path generator put in front of a title", () => {
    expect(readableTitle(`${STEP_MARK}Set up your machine`)).toBe("Set up your machine");
    expect(readableTitle(`${BLUEPRINT_MARK}Blueprint card`)).toBe("Blueprint card");
  });

  it("leaves an ordinary title alone", () => {
    expect(readableTitle("Read the handbook")).toBe("Read the handbook");
  });
});

describe("cardName", () => {
  it("names a checklist by its readable title, or by its kind when it has none", () => {
    expect(cardName(card({ kind: "CHECKLIST", title: `${STEP_MARK}Day one` }))).toBe("Day one");
    expect(cardName(card({ kind: "CHECKLIST", title: "" }))).toBe("Checklist");
  });

  it("names a note by its first non-empty line, as plain text", () => {
    expect(cardName(card({ kind: "NOTE", text: "\n\n## **Deploy** steps\nmore" }))).toBe(
      "Deploy steps",
    );
    expect(cardName(card({ kind: "NOTE", text: "   \n" }))).toBe("Note");
  });

  it("shortens a long first line so it fits in a dropdown", () => {
    const name = cardName(card({ kind: "NOTE", text: "x".repeat(60) }));

    expect(name).toHaveLength(48);
    expect(name.endsWith("…")).toBe(true);
  });

  it("names a link by its label, or by its address when it has none", () => {
    expect(cardName(card({ kind: "LINK", label: "Runbook", url: "https://r" }))).toBe("Runbook");
    expect(cardName(card({ kind: "LINK", label: null, url: "https://r" }))).toBe("https://r");
  });

  it.each([
    [{ kind: "DIAGRAM", subject: "Login flow" }, "Login flow"],
    [{ kind: "ARRIVAL_STEPS" }, "Your arrival steps"],
    [{ kind: "OPEN_PULL_REQUESTS" }, "Your open pull requests"],
    [{ kind: "CURRENT_TASK", title: "Fix the redirect" }, "Fix the redirect"],
    [{ kind: "CURRENT_TASK", title: null }, "The task you are on"],
    [{ kind: "SUGGESTED_TASKS" }, "Work worth picking up"],
    [{ kind: "TASK_POOL" }, "Task pool"],
    [{ kind: "COMPETENCY_PROGRESS" }, "What you have shown"],
    [{ kind: "MEMORY_RECAP" }, "What your buddy remembers"],
    [{ kind: "PATH_STEP", title: "Pair with Sam" }, "Pair with Sam"],
    [{ kind: "PATH_STEP", title: null }, PATH_STEP_FALLBACK_TITLE],
    [{ kind: "SOMETHING_NEW" }, "Card"],
  ])("names %o as %s", (content, expected) => {
    expect(cardName(card(content))).toBe(expected);
  });
});
