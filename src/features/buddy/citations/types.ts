/**
 * The citation vocabulary, in one place both surfaces can reach.
 *
 * Lived in `features/chatbot/types` until Buddy grew citations of its own (fe#266 slice 2,
 * 2026-10). The chat has been retired since (#206) and Buddy renders the sources, so the types
 * live with the one surface that uses them.
 */

/**
 * One retrieved source a reply leaned on.
 *
 * `artifactId` is what opens the artifact drawer; `sourceUrl` is only present for sources that
 * live somewhere outside the app (a GitHub blob, a Notion page), which is what the "Open source"
 * link falls back to when the drawer cannot be opened.
 *
 * The optional fields arrive as `null` (not absent) when a source has none — the backend
 * serializes them explicitly — so they are typed `| null` and every reader checks for both
 * `null` and `undefined`. Typing them as merely optional let a `Page null` / `Line null`
 * slip through a `!== undefined` check (caught in the review of fe#266 slice 2c).
 */
export type Citation = {
  /**
   * Id of the artifact (file) the citation refers to.
   */
  artifactId: string;

  /**
   * Name of the file the citation refers to.
   */
  filename: string;

  /**
   * Id of the citation itself, when the backend sent one.
   */
  id?: string;

  /**
   * Where the artifact came from (e.g. a GitHub URL), if known.
   */
  sourceUrl?: string | null;

  /**
   * 1-based source line the citation starts on, for text/code sources.
   */
  startLine?: number | null;

  /**
   * 1-based page the citation was extracted from, for PDF sources.
   */
  startPage?: number | null;
};

/**
 * A citation selected by the user, paired with the screen-space bounding rect
 * of the element they clicked (e.g. a `[1]` superscript). The rect lets the
 * popover position itself near the click instead of at a hardcoded location.
 */
export type SelectedCitation = {
  citation: Citation;
  rect: DOMRect;
};
