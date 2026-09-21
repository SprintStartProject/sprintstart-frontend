import { describe, it, expect, beforeEach } from "vitest";
import { QUOTE_LIMIT, quoteFromSelection } from "../../../../src/features/buddy/quoteFromSelection";
import { captureSelection } from "../../../../src/features/board/selection/selectionCapture";

/**
 * What a selection looks like once it is a message the hire has not sent yet.
 *
 * The toolbar that produces it is covered in `board/SelectionActions.test.tsx`; this is only about
 * the string, which is the part that has to survive being rendered as markdown.
 */
describe("quoteFromSelection", () => {
  /** A selection found somewhere the capture could not name — no heading, no page title. */
  const nowhere = (text: string) => ({ text, source: null, page: null });

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
  /**
   * The buddy cannot open a page — it searches this project's material by words. So the point of
   * this block is that the line reads as two searchable phrases, not that it reads nicely.
   */
  describe("where it was found", () => {
    it("names the part and the page it was on", () => {
      expect(
        quoteFromSelection({
          text: "The migration runs on deploy.",
          source: "Troubleshooting",
          page: "Set up your local environment",
        }),
      ).toBe(
        "> The migration runs on deploy.\n\nFrom Troubleshooting, on Set up your local environment\n\n",
      );
    });

    /**
     * The nearest heading is often the page's own title, so the two arrive equal as often as
     * not. Saying it twice reads as a stutter, not as precision.
     */
    it("says it once when the heading is the page's own name", () => {
      expect(
        quoteFromSelection({
          text: "Run it twice.",
          source: "Deployment guide",
          page: "Deployment guide",
        }),
      ).toBe("> Run it twice.\n\nFrom Deployment guide\n\n");
    });

    it("names the page alone when nothing above the selection was a heading", () => {
      expect(
        quoteFromSelection({ text: "Run it twice.", source: null, page: "Deployment guide" }),
      ).toContain("From Deployment guide");
    });

    it("names the heading alone when the document has no title", () => {
      expect(
        quoteFromSelection({ text: "Run it twice.", source: "Deployment", page: null }),
      ).toContain("From Deployment");
    });

    /** Still an empty line at the end: the question goes after the attribution, not before it. */
    it("leaves the caret under the attribution", () => {
      expect(
        quoteFromSelection({ text: "Run it twice.", source: "Deployment", page: "Runbook" }),
      ).toMatch(/\n\n$/);
    });

    it("says nothing when the capture could not name the place", () => {
      expect(quoteFromSelection(nowhere("Run it twice."))).not.toContain("From");
    });

    it("says nothing rather than 'From' with a blank after it", () => {
      expect(quoteFromSelection({ text: "Run it twice.", source: "   ", page: "  " })).toBe(
        "> Run it twice.\n\n",
      );
    });
  });

  /**
   * The same line, reached the way the toolbar reaches it: through `captureSelection` on a page
   * laid out like the app's. The cases above hand the quote an ideal `page`; these check that the
   * capture really produces one.
   *
   * The document title is set to what the app actually leaves it at, on every route, because that
   * is the trap: it names no page, and an attribution built from it says "on SprintStart".
   */
  describe("from a real capture", () => {
    beforeEach(() => {
      document.title = "SprintStart";
      document.body.innerHTML = "";
    });

    /** The app's shell: a sidebar carrying the product name, then the page in `<main>`. */
    function page(main: string) {
      document.body.innerHTML = `<aside><h1>SprintStart</h1></aside><main>${main}</main>`;
    }

    function quoteOf(selector: string): string {
      const node = document.querySelector(selector)!.firstChild!;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);

      const captured = captureSelection(selection);
      expect(captured).not.toBeNull();

      return quoteFromSelection(captured!);
    }

    it("names the heading and the page the header shows, never the document title", () => {
      page(
        "<header><h1>Set up your local environment</h1></header>" +
          "<h2>Troubleshooting</h2><p id='t'>Run the migration first.</p>",
      );

      expect(quoteOf("#t")).toBe(
        "> Run the migration first.\n\nFrom Troubleshooting, on Set up your local environment\n\n",
      );
    });

    it("names the page once when its header is the only heading above", () => {
      page("<header><h1>Knowledge base</h1></header><p id='t'>Run the migration first.</p>");

      expect(quoteOf("#t")).toBe("> Run the migration first.\n\nFrom Knowledge base\n\n");
    });
  });
});
