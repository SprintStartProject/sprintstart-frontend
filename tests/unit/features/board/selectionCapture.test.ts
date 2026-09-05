import { describe, it, expect, beforeEach } from "vitest";
import {
  captureSelection,
  cardFor,
  type CapturedSelection,
} from "../../../../src/features/board/selection/selectionCapture";

/**
 * The decisions behind "add this to my board", tested on strings and a real DOM rather than
 * through the toolbar — each one is arguable on its own, and a component test would hide which.
 */
describe("selectionCapture", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "SprintStart";
  });

  /** Builds a selection over the text of `selector`, the way a drag or shift-arrow would. */
  function selectTextIn(selector: string): Selection {
    const node = document.querySelector(selector)!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  }

  function capture(selector: string): CapturedSelection {
    const captured = captureSelection(selectTextIn(selector));
    expect(captured).not.toBeNull();
    return captured!;
  }

  describe("what is worth offering an action for", () => {
    it("ignores a collapsed caret", () => {
      expect(captureSelection(window.getSelection())).toBeNull();
    });

    it("ignores a whitespace-only selection", () => {
      document.body.innerHTML = "<p id='t'>   </p>";
      expect(captureSelection(selectTextIn("#t"))).toBeNull();
    });

    it("ignores text the hire is typing in", () => {
      document.body.innerHTML = "<div contenteditable='true' id='t'>a draft sentence</div>";
      expect(captureSelection(selectTextIn("#t"))).toBeNull();
    });

    it("collapses the whitespace a drag across elements picks up", () => {
      document.body.innerHTML = "<p id='t'>one\n   two</p>";
      expect(capture("#t").text).toBe("one two");
    });
  });

  describe("links", () => {
    it("prefers the anchor's href over the words inside it", () => {
      document.body.innerHTML = "<p><a id='t' href='https://example.test/guide'>the guide</a></p>";
      const card = cardFor(capture("#t"));

      expect(card).toEqual({ kind: "LINK", url: "https://example.test/guide", label: "the guide" });
    });

    it("treats a bare URL as a link", () => {
      document.body.innerHTML = "<p id='t'>https://example.test/page</p>";
      const card = cardFor(capture("#t"));

      expect(card.kind).toBe("LINK");
    });

    it("does not follow an in-page anchor", () => {
      document.body.innerHTML = "<p><a id='t' href='#section'>jump</a></p>";

      expect(cardFor(capture("#t")).kind).toBe("NOTE");
    });

    it("refuses a non-http scheme", () => {
      document.body.innerHTML = "<p id='t'>javascript:alert(1)</p>";

      expect(cardFor(capture("#t")).kind).toBe("NOTE");
    });

    /**
     * LinkCard renders the stored URL straight into an `href`, and the knowledge base renders
     * material ingested from elsewhere. An anchor's href gets the same scheme check bare text
     * does, or dragging across somebody else's issue body could mint a card that runs script.
     */
    it("refuses an anchor whose href is not http", () => {
      document.body.innerHTML = "<p><a id='t' href='javascript:alert(1)'>click me</a></p>";

      expect(cardFor(capture("#t")).kind).toBe("NOTE");
    });

    it("refuses a data: anchor too", () => {
      document.body.innerHTML = "<p><a id='t' href='data:text/html,hi'>click me</a></p>";

      expect(cardFor(capture("#t")).kind).toBe("NOTE");
    });

    it("resolves a relative href against the page, so the card means something elsewhere", () => {
      document.body.innerHTML = "<p><a id='t' href='/board'>your board</a></p>";
      const card = cardFor(capture("#t"));

      expect(card.kind).toBe("LINK");
      expect((card as { url: string }).url).toMatch(/^https?:\/\/.+\/board$/);
    });

    it("is not fooled by a sentence containing spaces", () => {
      document.body.innerHTML = "<p id='t'>see https://example.test for more</p>";

      expect(cardFor(capture("#t")).kind).toBe("NOTE");
    });
  });

  describe("where it came from", () => {
    it("names the nearest heading above the selection", () => {
      document.body.innerHTML = "<h2>Deployment</h2><p id='t'>Run the migration first.</p>";

      expect(capture("#t").source).toBe("Deployment");
    });

    it("takes the last heading passed, not the first", () => {
      document.body.innerHTML =
        "<h1>Handbook</h1><h2>Deployment</h2><p id='t'>Run the migration first.</p>";

      expect(capture("#t").source).toBe("Deployment");
    });

    it("ignores a heading that comes after the selection", () => {
      document.body.innerHTML = "<p id='t'>Run the migration first.</p><h2>Afterwards</h2>";
      document.title = "Knowledge base";

      expect(capture("#t").source).toBe("Knowledge base");
    });

    it("falls back to the page title when there is no heading", () => {
      document.body.innerHTML = "<p id='t'>Run the migration first.</p>";
      document.title = "Knowledge base";

      expect(capture("#t").source).toBe("Knowledge base");
    });
  });

  describe("the note it becomes", () => {
    it("puts a short selection in the heading and does not repeat it", () => {
      document.body.innerHTML = "<h2>Deployment</h2><p id='t'>Run the migration first.</p>";
      const card = cardFor(capture("#t"));

      expect(card).toEqual({
        kind: "NOTE",
        text: "Run the migration first.\n\nFrom Deployment",
      });
    });

    it("leads with a trimmed heading and keeps the whole text in the body", () => {
      const long =
        "The migration has to run before the deployment because the new column is not nullable " +
        "and the old rows would fail validation.";
      document.body.innerHTML = `<h2>Deployment</h2><p id='t'>${long}</p>`;
      const card = cardFor(capture("#t"));
      const [heading, body, attribution] = (card as { text: string }).text.split("\n\n");

      expect(heading.endsWith("…")).toBe(true);
      expect(heading.length).toBeLessThanOrEqual(81);
      // The real word-boundary property: what was kept is a prefix of the original, and the
      // character it stopped before is a space rather than the middle of a word.
      const lead = heading.slice(0, -1);
      expect(long.startsWith(lead)).toBe(true);
      expect(long[lead.length]).toBe(" ");
      expect(body).toBe(long);
      expect(attribution).toBe("From Deployment");
    });

    it("omits the attribution when there is nothing to attribute to", () => {
      document.body.innerHTML = "<p id='t'>Run the migration first.</p>";
      document.title = "";
      const card = cardFor(capture("#t"));

      expect((card as { text: string }).text).toBe("Run the migration first.");
    });
  });
});
