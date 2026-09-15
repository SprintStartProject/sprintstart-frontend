import { describe, it, expect } from "vitest";
import {
  extractChecklist,
  toChecklistRequest,
} from "../../../../src/features/board/generation/checklistFromMarkdown";

describe("extractChecklist", () => {
  it("finds a bulleted list and titles it from the line above", () => {
    const result = extractChecklist(
      "Here's where I'd start:\n\n- Clone the repo\n- Run the setup script\n- Say hi in #team",
    );

    expect(result).toEqual({
      title: "Here's where I'd start",
      items: ["Clone the repo", "Run the setup script", "Say hi in #team"],
    });
  });

  it("reads a numbered list and task boxes the same way", () => {
    const result = extractChecklist("## First week\n1. [ ] Get VPN\n2. [x] Read the runbook");

    expect(result?.title).toBe("First week");
    expect(result?.items).toEqual(["Get VPN", "Read the runbook"]);
  });

  it("keeps a loosely spaced list together", () => {
    // Blank lines are markdown spacing, not a list ending. Treating them as one would turn a
    // list of three into three lists of one, none of which qualifies.
    const result = extractChecklist("Steps:\n\n- One\n\n- Two\n\n- Three");

    expect(result?.items).toHaveLength(3);
  });

  it("prefers the longest list when a reply holds several", () => {
    const result = extractChecklist(
      "Caveats:\n- It's slow\n- It's flaky\n\nSteps:\n- A\n- B\n- C\n- D",
    );

    expect(result?.title).toBe("Steps");
    expect(result?.items).toEqual(["A", "B", "C", "D"]);
  });

  it("ignores a single bullet", () => {
    expect(extractChecklist("One thing:\n- Just this")).toBeNull();
  });

  it("returns nothing for prose", () => {
    expect(extractChecklist("You'll want to talk to Maria about the deploy keys.")).toBeNull();
  });

  it("strips markdown out of the lines", () => {
    const result = extractChecklist("Do:\n- **Bold** thing\n- Read [the docs](https://x.test)");

    expect(result?.items).toEqual(["Bold thing", "Read the docs"]);
  });

  it("falls back to a plain title when there is nothing above the list", () => {
    expect(extractChecklist("- One\n- Two")?.title).toBe("From your buddy");
  });
});

describe("toChecklistRequest", () => {
  it("builds an unticked checklist card", () => {
    const request = toChecklistRequest({ title: "Setup", items: ["A", "B"] });

    expect(request).toEqual({
      kind: "CHECKLIST",
      title: "Setup",
      items: [
        { text: "A", done: false },
        { text: "B", done: false },
      ],
    });
  });
});
