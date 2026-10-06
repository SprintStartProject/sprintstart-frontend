import type { AuthoredCardRequest } from "../types";
import { HEADING_LIMIT, composeNote, normalise, truncateAtWord } from "./noteComposition";

/**
 * Keeping something out of a conversation, on the board.
 *
 * The buddy's conversation is deliberately not durable — every visit opens fresh — so what gets
 * kept is the text itself, frozen; a link to it would point at whatever the buddy says tomorrow.
 * (The chat surface kept links instead, while it existed; that shape left with it.)
 */

/** What a saved buddy reply says it is. */
const BUDDY_SOURCE = "your buddy";

/**
 * Markdown flattened into something a plain-text card can show.
 *
 * `NoteCard` renders prose rather than markdown, on purpose: a note is the hire's own, and running
 * it through the same pipe as the cited, generated cards would make the two look alike. But an
 * answer that arrived *as* markdown and is shown raw reads as `**this**` — the formatting characters
 * become noise in a card small enough that a few stray asterisks are a third of a line.
 *
 * So the markers come off and the structure stays: a heading keeps its words, a list keeps its
 * bullet, a link keeps its text and says where it goes. Code fences are left exactly as they are —
 * the characters inside one are content, and "cleaning" them would change what the code says.
 */
export function plainFromMarkdown(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith("```")) return part;

      return (
        part
          // A heading is its words; the hashes said "this is a heading" to a renderer that is
          // no longer involved.
          .replace(/^#{1,6}[ \t]+/gm, "")
          // A list keeps a bullet, normalised to one character so three markdown dialects do not
          // become three kinds of list in the same card.
          .replace(/^[ \t]*[-*+][ \t]+/gm, "- ")
          .replace(/^[ \t]*>[ \t]?/gm, "")
          // Links: the words, then the address in brackets. Dropping the address would quietly
          // destroy the only part that cannot be found again.
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
          .replace(/(\*\*|__)(.*?)\1/g, "$2")
          .replace(/(\*|_)(.*?)\1/g, "$2")
          .replace(/`([^`]+)`/g, "$1")
      );
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * One answer, kept as a note.
 *
 * Used for both conversations, because a single message is the one thing they have in common: it
 * is text somebody wrote once, and freezing it is the honest way to keep it whatever the surface
 * around it does afterwards.
 */
export function messageNote(content: string, from: string): AuthoredCardRequest {
  return { kind: "NOTE", text: composeNote(plainFromMarkdown(content), from) };
}

/** One buddy reply, frozen — there is nowhere to link back to. See the module comment. */
export function buddyReplyNote(content: string): AuthoredCardRequest {
  return messageNote(content, BUDDY_SOURCE);
}

/** One turn of a conversation, as it is written into a transcript. */
export type TranscriptTurn = { speaker: string; content: string };

/**
 * A whole buddy conversation, frozen into one note.
 *
 * One card and not one per turn. A conversation is a thing the hire had, and twelve cards from it
 * would bury the eleven other things on the board under a morning's chat — which is the exact
 * complaint the board's structure exists to answer.
 *
 * It will be long, and that is what `NoteCard`'s fold is for: the card shows its first lines and
 * opens on request, so a kept conversation costs one card's worth of board whatever was said in it.
 *
 * Each turn is named, because a transcript that does not say who spoke is not a transcript. The
 * heading is taken from the *hire's first question* rather than from the buddy's first answer:
 * what a person remembers about a conversation is what they asked.
 */
export function transcriptNote(turns: TranscriptTurn[], askedBy: string): AuthoredCardRequest {
  const body = turns
    .map((turn) => `${turn.speaker}: ${plainFromMarkdown(turn.content)}`)
    .join("\n\n");

  const opening =
    turns.find((turn) => turn.speaker === askedBy)?.content ?? turns[0]?.content ?? "";
  const heading = truncateAtWord(normalise(plainFromMarkdown(opening)), HEADING_LIMIT);

  // Composed by hand rather than through `composeNote`, because the heading here is not a lead
  // taken from the body: it is one turn out of many, and the body has to stay whole.
  return {
    kind: "NOTE",
    text: [
      heading.length > 0 ? heading : "A conversation with your buddy",
      body,
      `From ${BUDDY_SOURCE}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
