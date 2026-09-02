/**
 * Turning whatever a hire has highlighted into something the board can hold.
 *
 * Kept apart from the component that renders the toolbar because none of it is React: it is a set
 * of decisions about text — is this a link, where did it come from, what should the card be called
 * — and each is easier to argue with when it can be tested on a string.
 */

import type { AuthoredCardRequest } from "../types";

/** What was selected, once it is worth offering an action for. */
export type CapturedSelection = {
  /** The selected text, trimmed and with collapsed whitespace runs. */
  text: string;
  /** The link the selection sits in or is, when it is one. */
  url: string | null;
  /** Where in the app it came from, in words. Null when nothing better than the app name exists. */
  source: string | null;
  /** Where the toolbar should sit, in viewport coordinates. */
  rect: DOMRect;
};

/**
 * How long a note's first line may be.
 *
 * The board renders a note's first line as the card's heading and the rest as its body
 * (`NoteCard.splitNote`), so this is a heading length, not a text limit — long enough to say what
 * the note is, short enough not to wrap into a paragraph pretending to be a title.
 */
const HEADING_LIMIT = 80;

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
 * A note's text: a heading line, then the quote, then where it came from.
 *
 * The heading is a lead taken from the selection rather than the source, because a board is
 * scanned for what a card *says*. When the whole selection already fits in a heading it is not
 * repeated underneath — a card that says the same thing twice reads as a bug.
 */
function noteText(capture: CapturedSelection): string {
  const heading = truncateAtWord(capture.text, HEADING_LIMIT);
  const attribution = capture.source ? `From ${capture.source}` : null;
  const body = heading === capture.text ? null : capture.text;

  return [heading, body, attribution].filter(Boolean).join("\n\n");
}

/** Collapses the whitespace a drag across elements picks up, without touching the words. */
function normalise(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Cuts at the last word boundary that fits, so a heading never ends mid-word.
 *
 * A single word longer than the limit is cut anyway — there is no boundary to prefer, and the full
 * text is in the body regardless.
 */
function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
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
  if (href && !href.startsWith("#")) return anchor?.href ?? href;
  return isUrl(text) ? text : null;
}

/** Only http(s). A `javascript:` or `data:` selection is not a link somebody meant to keep. */
function isUrl(text: string): boolean {
  if (/\s/.test(text)) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
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
