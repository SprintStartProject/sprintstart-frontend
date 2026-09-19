import type { ArtifactContent } from "./types";

/**
 * How many lines of real content an artifact needs before asking the AI for a
 * summary is worth the round trip.
 *
 * The AI service accepts a one-line file happily and answers that there is
 * nothing to summarise — after indexing it. The reader pays seconds for an
 * answer the file itself already gave away, so the action is not offered below
 * this line count.
 */
export const MIN_SUMMARY_LINES = 4;

/**
 * Counts the lines of an artifact's text that actually carry something.
 *
 * Blank lines are not content: a file of four newlines is empty, not four lines
 * long. Both `\r\n` and `\n` count as a break, because uploads arrive from
 * Windows and Unix alike.
 */
export function countContentLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

/**
 * Whether the content is text this module is able to judge.
 *
 * PDFs and images come back from the content endpoint as an object URL rather
 * than as text — there is nothing to count, and the AI service reads those
 * formats on its own. Judging them by a "line count" would block summaries for
 * exactly the files that need one most.
 */
function isTextContent(content: ArtifactContent): boolean {
  if (content.isObjectUrl) return false;
  if (content.mimeType === "application/pdf") return false;

  return !content.mimeType.startsWith("image/");
}

/**
 * Why summarising is not available for this content, or `null` when it is.
 *
 * Returns `null` while the content is still loading, deliberately: the summary
 * request does not need the content, and a primary action that flickers from
 * unavailable to available on every open is worse than one that occasionally
 * answers "nothing to summarise" for a file the reader can already see is
 * empty. Only a *known* empty or near-empty artifact is refused, which is the
 * case the round trip cannot fix.
 *
 * The caller decides what to do with the reason: the drawer disables the
 * button and shows the reason as a tooltip, so the action never disappears
 * without an explanation.
 */
/**
 * Whether the artifact was imported with no body at all.
 *
 * The case this exists for: a pull request or issue whose description was never
 * written, or a file whose bytes are blank. The artifact is real — it has a
 * title, a source and a URL — but there is nothing to read, and nothing to
 * summarise. The viewer says so instead of rendering an empty pane, which reads
 * as a broken drawer rather than as an empty body.
 *
 * `false` while the content is still loading, and `false` for the formats this
 * module cannot read at all (see {@link isTextContent}).
 */
export function isEmptyContent(content: ArtifactContent | null): boolean {
  return content !== null && isTextContent(content) && countContentLines(content.content) === 0;
}

export function summariseBlockReason(content: ArtifactContent | null): string | null {
  if (!content || !isTextContent(content)) return null;

  if (isEmptyContent(content)) {
    return "Nothing to summarise — this artifact is empty";
  }

  const lines = countContentLines(content.content);

  if (lines < MIN_SUMMARY_LINES) {
    return `Too short to summarise — ${lines} line${lines === 1 ? "" : "s"} of content`;
  }

  return null;
}
