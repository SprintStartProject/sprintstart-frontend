import { describe, it, expect } from "vitest";
import { QUOTE_LIMIT, quoteFromSelection } from "../../../../src/features/buddy/quoteFromSelection";

/**
 * What a selection looks like once it is a message the hire has not sent yet.
 *
 * The toolbar that produces it is covered in `board/SelectionActions.test.tsx`; this is only about
 * the string, which is the part that has to survive being rendered as markdown.
 */
describe("quoteFromSelection", () => {
  /** A selection found somewhere the capture could not name — no heading, no page title. */
  const nowhere = (text: string) => ({ text, source: null });

  it("quotes the selection", () => {
    expect(quoteFromSelection(nowhere("The migration runs on deploy."))).toMatch(
      /^> The migration runs on deploy\./,
    );
  });

  /**
   * The blank line is where the caret lands, and it is the reason nothing is sent from the
   * toolbar: the hire's question goes here.
   */
  it("leaves an empty line under the quote for the question", () => {
    expect(quoteFromSelection(nowhere("The migration runs on deploy."))).toBe(
      "> The migration runs on deploy.\n\n",
    );
  });

  it("keeps a selection that is already short", () => {
    const text = "a".repeat(QUOTE_LIMIT);

    expect(quoteFromSelection(nowhere(text))).toBe(`> ${text}\n\n`);
  });

  /**
   * A quote silently missing its last clause is one the buddy would answer as though it were
   * whole, and the hire would have no way to tell.
   */
  it("marks a selection it had to cut", () => {
    const quote = quoteFromSelection(nowhere(`${"word ".repeat(400)}end`));

    expect(quote).toContain("…");
    expect(quote.length).toBeLessThan(QUOTE_LIMIT + 10);
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const quote = quoteFromSelection(nowhere(`${"word ".repeat(400)}end`));

    expect(quote).not.toMatch(/wor…/);
  });

  /**
   * Where the hire was is part of what they are asking. The same sentence the board writes onto a
   * note made from the same selection — one question about a selection, one answer to it.
   */
  describe("where it was found", () => {
    it("says where the selection came from", () => {
      expect(
        quoteFromSelection({
          text: "The migration runs on deploy.",
          source: "the deployment guide",
        }),
      ).toBe("> The migration runs on deploy.\n\nFrom the deployment guide\n\n");
    });

    /** Still an empty line at the end: the question goes after the attribution, not before it. */
    it("leaves the caret under the attribution", () => {
      expect(quoteFromSelection({ text: "Run it twice.", source: "Deployment" })).toMatch(/\n\n$/);
    });

    it("says nothing when the capture could not name the place", () => {
      expect(quoteFromSelection({ text: "Run it twice.", source: null })).not.toContain("From");
    });

    it("says nothing rather than 'From' with a blank after it", () => {
      expect(quoteFromSelection({ text: "Run it twice.", source: "   " })).toBe(
        "> Run it twice.\n\n",
      );
    });
  });
});
