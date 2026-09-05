import { describe, expect, it } from "vitest";

import {
  questionAboutChecklist,
  questionAboutLink,
  questionAboutNote,
} from "../../../../src/features/board/generation/cardQuestion";

describe("the first sentence of a question about a card", () => {
  describe("a note", () => {
    it("asks about the note when nothing in it is marked", () => {
      expect(questionAboutNote("Deploys are on Thursdays.", [])).toContain(
        '"Deploys are on Thursdays."',
      );
    });

    it("asks about what was marked instead, when something is", () => {
      // Somebody who highlighted a sentence has already said which part they are stuck on.
      const question = questionAboutNote("Deploys are on Thursdays. Ask in #release.", [
        "Ask in #release",
      ]);

      expect(question).toContain('"Ask in #release"');
      expect(question).not.toContain("Deploys are on Thursdays");
    });

    it("quotes at most two marks, so the composer opens with a question and not a transcript", () => {
      const question = questionAboutNote("x", ["one", "two", "three"]);

      expect(question).toContain('"one" and "two"');
      expect(question).not.toContain("three");
    });

    it("does not put the highlighter's own characters in the question", () => {
      expect(questionAboutNote("Deploys are ==on Thursdays==", [])).not.toContain("==");
    });
  });

  it("names a link by its label and still says where it goes", () => {
    expect(questionAboutLink("The runbook", "https://example.com/rb")).toContain(
      '"The runbook" (https://example.com/rb)',
    );
    expect(questionAboutLink(null, "https://example.com/rb")).toContain("https://example.com/rb");
  });

  describe("a checklist", () => {
    it("counts what is still open", () => {
      expect(questionAboutChecklist("Paperwork", 3, [])).toContain("3 still to do");
    });

    it("asks what comes next once nothing is open", () => {
      expect(questionAboutChecklist("Paperwork", 0, [])).toContain("finished");
    });

    it("asks about what was marked instead, when something is", () => {
      expect(questionAboutChecklist("Paperwork", 3, ["sign the NDA"])).toContain('"sign the NDA"');
    });

    it("has a name for a list that has none", () => {
      expect(questionAboutChecklist(null, 2, [])).toContain("a checklist");
    });
  });
});
