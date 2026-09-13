import { describe, it, expect } from "vitest";
import { QUOTE_LIMIT, quoteFromSelection } from "../../../../src/features/buddy/quoteFromSelection";

/**
 * What a selection looks like once it is a message the hire has not sent yet.
 *
 * The toolbar that produces it is covered in `board/SelectionActions.test.tsx`; this is only about
 * the string, which is the part that has to survive being rendered as markdown.
 */
describe("quoteFromSelection", () => {
  it("quotes the selection", () => {
    expect(quoteFromSelection({ text: "The migration runs on deploy." })).toMatch(
      /^> The migration runs on deploy\./,
    );
  });

  /**
   * The blank line is where the caret lands, and it is the reason nothing is sent from the
   * toolbar: the hire's question goes here.
   */
  it("leaves an empty line under the quote for the question", () => {
    expect(quoteFromSelection({ text: "The migration runs on deploy." })).toBe(
      "> The migration runs on deploy.\n\n",
    );
  });

  it("keeps a selection that is already short", () => {
    const text = "a".repeat(QUOTE_LIMIT);

    expect(quoteFromSelection({ text })).toBe(`> ${text}\n\n`);
  });

  /**
   * A quote silently missing its last clause is one the buddy would answer as though it were
   * whole, and the hire would have no way to tell.
   */
  it("marks a selection it had to cut", () => {
    const quote = quoteFromSelection({ text: `${"word ".repeat(400)}end` });

    expect(quote).toContain("…");
    expect(quote.length).toBeLessThan(QUOTE_LIMIT + 10);
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const quote = quoteFromSelection({ text: `${"word ".repeat(400)}end` });

    expect(quote).not.toMatch(/wor…/);
  });
});
