/**
 * Turning whatever a hire has highlighted into something the board can hold.
 *
 * Kept apart from the component that renders the toolbar because none of it is React: it is a set
 * of decisions about text — is this a link, where did it come from, what should the card be called
 * — and each is easier to argue with when it can be tested on a string.
 */

import type { AuthoredCardRequest } from "../types";
import { originUrl } from "./textFragment";
import { composeNote, normalise } from "../generation/noteComposition";

/** What was selected, once it is worth offering an action for. */
export type CapturedSelection = {
  /** The selected text, trimmed and with collapsed whitespace runs. */
  text: string;
  /** The link the selection sits in or is, when it is one. */
  url: string | null;
  /** Where in the app it came from, in words. Null when nothing better than the app name exists. */
  source: string | null;
  /**
   * Where in the app it came from, as something you can click.
   *
   * An in-app path plus a text fragment naming the selected words, so the card this becomes can
   * take the hire back to the paragraph rather than to the top of the page. See `textFragment.ts`
   * for what that costs and where it degrades.
   */
  origin: string;
  /**
   * The board card the selection landed inside, or null when it landed anywhere else.
   *
   * Read off the nearest `data-card-id` ancestor. Text inside a card is not material to *make* a
   * card out of — it is already on the board — so this is what lets the toolbar offer the marker
   * pen there and the "keep this" everywhere else.
   */
  cardId: string | null;
  /** Where the toolbar should sit, in viewport coordinates. */
  rect: DOMRect;
};

/** Anything shorter is a stray click or a double-click that caught a space, not a selection. */
const MIN_SELECTION_LENGTH = 2;

/**
 * The current selection, or null when there is nothing worth acting on.
 *
 * Returns null rather than an empty capture for a collapsed caret, a whitespace-only drag, or a
 * selection inside an input the hire is editing — offering to file somebody's half-typed sentence
 * as a note is noise on top of their actual task.
 */
export function captureSelection(selection: Selection | null): CapturedSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = normalise(selection.toString());
  if (text.length < MIN_SELECTION_LENGTH) return null;

  const anchor = selection.anchorNode;
  if (!anchor || isInsideEditable(anchor)) return null;

  const range = selection.getRangeAt(0);
  return {
    text,
    url: linkFor(anchor, text),
    source: sourceFor(anchor),
    origin: originUrl(window.location, text),
    cardId: elementOf(anchor)?.closest("[data-card-id]")?.getAttribute("data-card-id") ?? null,
    rect: range.getBoundingClientRect(),
  };
}

/**
 * The card a capture should become.
 *
 * A link becomes a `LINK` card and everything else a `NOTE`, because those are different things to
 * a hire looking at their board a week later: one is somewhere to go back to, the other is
 * something that was said.
 */
export function cardFor(capture: CapturedSelection): AuthoredCardRequest {
  if (capture.url) {
    return { kind: "LINK", url: capture.url, label: capture.text || null };
  }
  return { kind: "NOTE", text: noteText(capture) };
}

/**
 * A note's text — the shared composition every surface uses that turns found text into a note.
 * See `generation/noteComposition.ts` for what the three parts are and why the attribution is
 * written into the text as well as recorded as an origin.
 */
function noteText(capture: CapturedSelection): string {
  return composeNote(capture.text, capture.source);
}

/**
 * The URL this selection stands for, if any.
 *
 * Two ways to be a link, and the anchor wins: text reading "the deployment guide" inside an
 * `<a>` is a better link than it is a note, and its href is the thing worth keeping. Failing that,
 * a selection that is *itself* a URL is one too — people copy bare links around constantly.
 */
function linkFor(node: Node, text: string): string | null {
  const anchor = elementOf(node)?.closest("a");
  const href = anchor?.getAttribute("href");
  if (href && !href.startsWith("#")) {
    // `anchor.href` rather than the attribute: it resolves a relative link against the page, and a
    // card holding "/board" would mean nothing from anywhere else.
    const resolved = httpUrl(anchor?.href ?? href);
    if (resolved) return resolved;
  }
  // A selection containing whitespace is prose that mentions a link, not a link.
  return /\s/.test(text) ? null : httpUrl(text);
}

/**
 * The URL, if it is one worth putting behind a link — `http(s)` only.
 *
 * Applied to an anchor's href as much as to bare text, and that is the point. `LinkCard` renders
 * the stored URL straight into an `href`, and the knowledge base renders material this project
 * ingested from elsewhere. A `javascript:` or `data:` link in somebody else's issue body is not
 * something to mint a card from because a hire happened to drag across it.
 */
function httpUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * Where on the page the selection came from, in words a hire would recognise.
 *
 * The nearest heading above it, because that is what somebody would say if asked — "the bit under
 * Deployment". `document.title` is the fallback and not the first choice: it names the page, and a
 * page is bigger than the paragraph that was actually worth keeping.
 */
function sourceFor(node: Node): string | null {
  const heading = nearestHeadingAbove(node);
  if (heading) return heading;
  const title = document.title.trim();
  return title.length > 0 ? title : null;
}

/**
 * The last heading that appears before the selection in document order.
 *
 * Document order rather than DOM ancestry: a heading is almost never an ancestor of the text it
 * introduces, so walking up the tree finds nothing. Comparing positions finds the heading a reader
 * would have passed on the way down.
 */
function nearestHeadingAbove(node: Node): string | null {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
  let found: string | null = null;

  for (const heading of headings) {
    const position = heading.compareDocumentPosition(node);
    const isAfterHeading = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (isAfterHeading) {
      const text = normalise(heading.textContent ?? "");
      if (text.length > 0) found = text;
    }
  }
  return found;
}

/**
 * Whether the selection is inside something the hire is typing in.
 *
 * Selecting your own half-written sentence is how people edit, not how they collect — offering to
 * file it interrupts the thing they were actually doing.
 */
function isInsideEditable(node: Node): boolean {
  const element = elementOf(node);
  if (!element) return false;
  if (element.closest("input, textarea")) return true;
  return element.closest('[contenteditable="true"]') !== null;
}

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}
