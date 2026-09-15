/**
 * The part of a URL that says *which words*, not just which page.
 *
 * A card that came from a paragraph should be able to take the hire back to that paragraph, and a
 * path alone cannot: the knowledge base runs to thousands of words, and "somewhere on this page"
 * is the answer they already had. A text fragment — `#:~:text=…`, the thing Google's "jump to
 * highlight" links use — is the one way to name a position that survives the page being re-rendered,
 * re-ordered, or re-fetched, because it names the *text* rather than an element or an offset.
 *
 * **It is a best effort, and that is the whole design.** Chromium and Safari scroll to the words and
 * highlight them; Firefox ignores the fragment and lands at the top of the page; and any browser
 * gives up when the text has since changed. All three of those are the same outcome the hire would
 * have had without it, so nothing is lost by trying — which is why this is never gated on support.
 */

/**
 * How much of a selection goes into the fragment before it is described by its two ends instead.
 *
 * The spec's `textStart,textEnd` form exists for exactly this: a long quote in a URL is a URL
 * nobody can read and a fragment that breaks on a single re-flowed space in the middle. Naming the
 * first and last few words is both shorter and *more* robust, because everything between them is
 * allowed to have changed.
 */
const INLINE_LIMIT = 60;

/** Words taken from each end when a selection is described by its ends. */
const EDGE_WORDS = 5;

/**
 * The characters that mean something to the fragment syntax itself.
 *
 * `-` separates a prefix from its match, `,` separates the parts, and `&` ends the fragment
 * directive. `encodeURIComponent` leaves all three alone, so they are escaped by hand — a selection
 * containing a comma would otherwise be read as two halves of a range.
 */
function escapeFragmentText(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/** The first and last few words of a selection, for the `textStart,textEnd` form. */
function ends(text: string): { start: string; end: string } {
  const words = text.split(" ");
  return {
    start: words.slice(0, EDGE_WORDS).join(" "),
    end: words.slice(-EDGE_WORDS).join(" "),
  };
}

/**
 * The `#:~:text=…` fragment for a piece of selected text, or an empty string when there is nothing
 * worth pointing at.
 *
 * Expects the already-normalised selection text — the whitespace a drag across elements picks up
 * would otherwise be encoded into the fragment and match nothing.
 */
export function textFragment(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";

  if (trimmed.length <= INLINE_LIMIT) {
    return `#:~:text=${escapeFragmentText(trimmed)}`;
  }

  const { start, end } = ends(trimmed);
  // A selection long enough to split but with no space in it — one enormous token — has no two ends
  // to name, so it falls back to pointing at its beginning.
  if (start === end) return `#:~:text=${escapeFragmentText(start)}`;

  return `#:~:text=${escapeFragmentText(start)},${escapeFragmentText(end)}`;
}

/**
 * Where in the app a selection was made, as something that can be put in an `href`.
 *
 * A path rather than an absolute URL: this always points back inside the app, and a stored
 * `http://localhost:5173/...` would be a card that only works on the machine it was made on.
 */
export function originUrl(location: { pathname: string; search: string }, text: string): string {
  return `${location.pathname}${location.search}${textFragment(text)}`;
}
