import { describe, expect, it } from "vitest";

import {
  addMark,
  enclosingMark,
  hasMarks,
  isMarked,
  removeMark,
  splitMarks,
  stripMarks,
  toggleMark,
  unmarkPart,
} from "../../../../src/features/board/marks/markup";

describe("the highlighter, as two equals signs", () => {
  describe("reading", () => {
    it("splits a note into marked and unmarked runs", () => {
      expect(splitMarks("deploys are ==on Thursdays== unless")).toEqual([
        { text: "deploys are ", marked: false },
        { text: "on Thursdays", marked: true },
        { text: " unless", marked: false },
      ]);
    });

    it("does not light up the rest of a note over an unclosed pair", () => {
      // Somebody mid-sentence, or a line of ===== used as a rule.
      expect(splitMarks("deploys ==are on Thursdays")).toEqual([
        { text: "deploys ==are on Thursdays", marked: false },
      ]);
    });

    it("treats an empty pair as characters rather than as a highlight", () => {
      expect(hasMarks("a ==== b")).toBe(false);
    });

    it("strips the delimiters for a reader", () => {
      expect(stripMarks("deploys are ==on Thursdays==")).toBe("deploys are on Thursdays");
    });
  });

  describe("marking", () => {
    it("wraps the selected words", () => {
      expect(toggleMark("deploys are on Thursdays", "on Thursdays")).toBe(
        "deploys are ==on Thursdays==",
      );
    });

    it("takes the mark off again when the same words are pressed twice", () => {
      expect(toggleMark("deploys are ==on Thursdays==", "on Thursdays")).toBe(
        "deploys are on Thursdays",
      );
    });

    it("leaves a note alone when the selection is not in it", () => {
      const note = "deploys are on Thursdays";

      expect(toggleMark(note, "on Fridays")).toBe(note);
      expect(toggleMark(note, "   ")).toBe(note);
    });

    it("does not nest one mark inside another", () => {
      // "Thursdays" is already inside a highlight; marking it again would produce a pair the
      // parser closes at the wrong place.
      const note = "deploys are ==on Thursdays== every week";

      expect(toggleMark(note, "Thursdays")).toBe(note);
    });

    it("marks an occurrence outside an existing highlight", () => {
      expect(toggleMark("==deploys== happen when deploys happen", "deploys happen")).toBe(
        "==deploys== happen when ==deploys happen==",
      );
    });
  });
});

describe("adding and removing without guessing which way it goes", () => {
  it("adds only when it is not already marked", () => {
    expect(addMark("deploys are on Thursdays", "on Thursdays")).toBe(
      "deploys are ==on Thursdays==",
    );
    expect(addMark("deploys are ==on Thursdays==", "on Thursdays")).toBe(
      "deploys are ==on Thursdays==",
    );
  });

  it("removes only when it is marked", () => {
    expect(removeMark("deploys are ==on Thursdays==", "on Thursdays")).toBe(
      "deploys are on Thursdays",
    );
    expect(removeMark("deploys are on Thursdays", "on Thursdays")).toBe("deploys are on Thursdays");
  });

  it("knows whether exactly these words are marked", () => {
    expect(isMarked("deploys are ==on Thursdays==", "on Thursdays")).toBe(true);
    // A word *inside* a highlight is not itself the highlight — pressing the eraser on it would
    // otherwise promise to remove something this cannot remove.
    expect(isMarked("deploys are ==on Thursdays==", "Thursdays")).toBe(false);
    expect(isMarked("deploys are on Thursdays", "on Thursdays")).toBe(false);
  });
});

describe("rubbing out part of a highlight", () => {
  it("keeps what was marked either side of the selection", () => {
    expect(unmarkPart("==deploys are on Thursdays==", "are")).toBe(
      "==deploys== are ==on Thursdays==",
    );
  });

  it("takes the whole thing when the whole thing was selected", () => {
    expect(unmarkPart("a ==big deal== here", "big deal")).toBe("a big deal here");
  });

  it("leaves the spaces outside the delimiters", () => {
    // `==deploys ==` would paint a stripe running past the last letter.
    const result = unmarkPart("==deploys are on Thursdays==", "are on");

    expect(result).toBe("==deploys== are on ==Thursdays==");
  });

  it("drops an end that is only whitespace rather than marking it", () => {
    expect(unmarkPart("==deploys are==", "deploys")).toBe("deploys ==are==");
  });

  it("leaves text alone when the selection is not inside a highlight", () => {
    expect(unmarkPart("deploys are on Thursdays", "are")).toBe("deploys are on Thursdays");
  });

  it("finds the highlight a selection sits inside", () => {
    expect(enclosingMark("a ==big deal== here", "deal")).toBe("big deal");
    expect(enclosingMark("a ==big deal== here", "here")).toBeNull();
  });
});
