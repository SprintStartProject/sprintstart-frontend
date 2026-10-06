/**
 * The citation vocabulary, in one place both surfaces can reach.
 *
 * Lived in `features/chatbot/types` until Buddy grew citations of its own (fe#266 slice 2,
 * 2026-10). The chat is being retired and Buddy renders the sources from now on, so the types
 * cannot stay inside the folder that is about to be deleted — `features/chatbot` re-points here
 * until #206 removes it, and nothing in `features/buddy` imports from the chat again.
 */

/**
 * One retrieved source a reply leaned on.
 *
 * `artifactId` is what opens the artifact drawer; `sourceUrl` is only present for sources that
 * live somewhere outside the app (a GitHub blob, a Notion page), which is what the "Open source"
 * link falls back to when the drawer cannot be opened.
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
   * Where the artifact came from (e.g. a GitHub URL), if known.
   */
  sourceUrl?: string;

  /**
   * 1-based source line the citation starts on, for text/code sources.
   */
  startLine?: number;

  /**
   * 1-based page the citation was extracted from, for PDF sources.
   */
  startPage?: number;
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
