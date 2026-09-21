import { describe, it, expect, beforeEach } from "vitest";
import {
  captureSelection,
  cardFor,
  selectionQuoteText,
  type CapturedSelection,
} from "../../../../src/features/board/selection/selectionCapture";
import { insertQuoteIntoDraft } from "../../../../src/features/chatbot/utils/quoteFormat";

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

    it("identifies when selection is inside an AI assistant message", () => {
      document.body.innerHTML =
        "<div data-chat-message-role='ASSISTANT'><p id='t'>AI response content</p></div>";
      expect(capture("#t").isAiMessage).toBe(true);
    });

    it("identifies when selection is inside a user message", () => {
      document.body.innerHTML =
        "<div data-chat-message-role='USER'><p id='t'>User prompt question</p></div>";
      expect(capture("#t").isAiMessage).toBe(false);
    });

    it("marks isAiMessage false for generic text outside chat", () => {
      document.body.innerHTML = "<div class='docs'><p id='t'>Documentation guide</p></div>";
      expect(capture("#t").isAiMessage).toBe(false);
    });

    /**
     * A drag across two bubbles, reported the way a browser hands a selection over — the range
     * as dragged, the anchor on whichever end the drag began. jsdom has no layout, so the
     * toString a real browser would carry has to be stated rather than derived.
     */
    function dragAcross(
      startSelector: string,
      endSelector: string,
      endOffset: number,
      anchorAtStart: boolean,
    ): Selection {
      const startNode = document.querySelector(startSelector)!.firstChild!;
      const endNode = document.querySelector(endSelector)!.firstChild!;
      const range = document.createRange();
      range.setStart(startNode, 0);
      range.setEnd(endNode, endOffset);
      return {
        isCollapsed: false,
        rangeCount: 1,
        anchorNode: anchorAtStart ? range.startContainer : range.endContainer,
        getRangeAt: () => range,
        toString: () => "The answer. A follow-up question?",
      } as unknown as Selection;
    }

    const twoBubbles =
      "<div data-chat-message-role='ASSISTANT'><p id='a1'>The answer.</p></div>" +
      "<div data-chat-message-role='USER'><p id='u1'>A follow-up question?</p></div>" +
      "<div data-chat-message-role='ASSISTANT'><p id='a2'>Another answer.</p></div>";

    it("says no when the drag runs from an answer into the next message", () => {
      document.body.innerHTML = twoBubbles;

      expect(captureSelection(dragAcross("#a1", "#u1", 6, true))!.isAiMessage).toBe(false);
    });

    /**
     * The same visual selection, dragged the other way. The old check read the drag's anchor as
     * a fallback and answered differently for it; both ends have to sit in one bubble, which
     * does not care about direction.
     */
    it("says the same for the same selection dragged the other way", () => {
      document.body.innerHTML = twoBubbles;

      expect(captureSelection(dragAcross("#a1", "#u1", 6, false))!.isAiMessage).toBe(false);
    });

    it("says no when the selection spans two answers", () => {
      document.body.innerHTML = twoBubbles;

      expect(captureSelection(dragAcross("#a1", "#a2", 4, true))!.isAiMessage).toBe(false);
    });

    it("still says yes when the selection spans paragraphs inside one answer", () => {
      document.body.innerHTML =
        "<div data-chat-message-role='ASSISTANT'><p id='a1'>First part.</p><p id='a2'>Second part.</p></div>";

      expect(captureSelection(dragAcross("#a1", "#a2", 6, true))!.isAiMessage).toBe(true);
    });
  });

  describe("the quote the Reply offer sends", () => {
    /**
     * A selection the way a browser reports it, with the toString a real drag carries. jsdom's
     * own toString never inserts the newlines a browser puts between block elements, so stubbing
     * it in is the one honest way to exercise a multi-paragraph capture here.
     */
    function selectionReporting(selector: string, rawText: string): Selection {
      const range = selectTextIn(selector).getRangeAt(0);
      return {
        isCollapsed: false,
        rangeCount: 1,
        anchorNode: range.startContainer,
        getRangeAt: () => range,
        toString: () => rawText,
      } as unknown as Selection;
    }

    it("keeps the paragraph breaks that `text` collapses away", () => {
      document.body.innerHTML = "<div id='t'><p>First paragraph.</p><p>Second paragraph.</p></div>";
      const captured = captureSelection(
        selectionReporting("#t", "First paragraph.\n\nSecond paragraph."),
      )!;

      expect(captured.text).toBe("First paragraph. Second paragraph.");
      expect(captured.quoteText).toBe("First paragraph.\nSecond paragraph.");
    });

    /**
     * The path the review flagged, end to end: a real multi-paragraph answer, captured the way
     * the toolbar captures it, through to what lands in the composer. The paragraph breaks have
     * to survive as separate quoted paragraphs, not one collapsed line.
     */
    it("lands a two-paragraph answer as two quoted paragraphs in the draft", () => {
      document.body.innerHTML = "<div id='t'><p>First paragraph.</p><p>Second paragraph.</p></div>";
      const captured = captureSelection(
        selectionReporting("#t", "First paragraph.\n\nSecond paragraph."),
      )!;

      expect(insertQuoteIntoDraft("", captured.quoteText)).toBe(
        "> First paragraph.\n>\n> Second paragraph.\n\n",
      );
    });

    it("drops empty lines and stray spacing from the raw selection text", () => {
      expect(selectionQuoteText("  First   word \n\n\nsecond\n\t\n  last  ")).toBe(
        "First word\nsecond\nlast",
      );
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
