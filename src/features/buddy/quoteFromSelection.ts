/**
 * Turning something the hire highlighted into the opening of a message to the buddy.
 *
 * The gesture this serves is *"explain this"*. A hire reading an onboarding step, a knowledge-base
 * page or a pull request finds a sentence they do not follow, and the cost of asking about it has
 * to be lower than the cost of retyping it — otherwise they either retype it badly or do not ask.
 *
 * Kept apart from the toolbar that renders the button, for the same reason `selectionCapture.ts`
 * is: none of it is React. It is a decision about what a quoted message looks like, and that is
 * easier to argue with when it can be tested on a string.
 *
 * **This is not a breach of the rule that the frontend never sends content on the hire's behalf,
 * and the distinction is worth writing down because it looks like one.** That rule exists so the
 * backend stays the thing that resolves *what data a caller may see* — "the agent never supplies
 * whose data to read" (`BuddyToolExecutor` KDoc). A quote is the hire speaking, in their own
 * message, about words already on their own screen: it asserts nothing about what exists, nothing
 * about whose it is, and nothing about who may read it. The backend resolves the hire from their
 * session exactly as it does for a question they typed by hand.
 *
 * Two consequences follow, and both are load-bearing below. The draft is *seeded, never sent* —
 * see {@link quoteFromSelection} — because a quote with no question attached is not yet a thing
 * anybody meant to ask. And a future context-reference feature, where the buddy is handed a
 * *pointer* to material and fetches it, is a different mechanism under different rules; nothing
 * here licenses it.
 *
 * The same line separates what the attribution may say. **Where the hire was is part of their
 * question; a URL for the buddy to follow is not.** The buddy has no tool that opens a page — what
 * it has is `search_canonical_answers`, which takes *words* and searches this project's own
 * material. So the attribution is written to be searchable rather than clickable: an in-app path
 * with a text fragment on the end is a pointer nothing on the other end can follow, while
 * "Troubleshooting, on Set up your local environment" is two phrases the buddy can go and read the
 * rest of. That is also where the issue draws the line — handing the buddy a reference it resolves
 * itself is the context-reference mechanism, a different feature under different rules.
 *
 * Hence both halves of where it was found: the heading says which part, the page's own header says
 * which page (`pageTitleFor` in `selectionCapture.ts`), and either on its own can send the search after the wrong thing. `origin` stays out.
 */

import type { CapturedSelection } from "../board/selection/selectionCapture";

/**
 * How much of a selection is carried into the composer.
 *
 * Generous, because the point is not to make the hire retype — but not unbounded: a hire who
 * selected an entire page would otherwise open the dock onto a composer they have to scroll
 * through to find the end of, and the question they came to ask is the part at the end.
 */
export const QUOTE_LIMIT = 600;

/**
 * The draft a selection becomes: the words as a markdown quote, where they were found, then an
 * empty line for the question.
 *
 * A blockquote rather than plain text, because the transcript renders markdown and the hire should
 * be able to see at a glance which part of their own message they wrote. One line is all this ever
 * has to prefix: `captureSelection` collapses whitespace runs on the way in, so a drag across four
 * paragraphs arrives here as one.
 *
 * `From <place>` under it, opening with the same word the board's notes use
 * (`board/generation/noteComposition.ts`), so a hire who keeps a selection and a hire who asks
 * about one read the same sentence. Both halves when they differ — *"From Troubleshooting, on Set up
 * your local environment"* — and one when the heading is all there is, or is the page's own name
 * anyway. A hire who does not want the line deletes it, because nothing has been sent.
 *
 * The trailing blank line is where the caret ends up, and it is the whole reason nothing is sent
 * from here: the hire almost always wants to add *"what does this mean"* or *"is this still true"*
 * to it, and a message that left without them is a message they did not ask.
 */
export function quoteFromSelection(
  selection: Pick<CapturedSelection, "text" | "source" | "page">,
): string {
  const quote = `> ${clamp(selection.text.trim(), QUOTE_LIMIT)}`;

  return `${[quote, whereFrom(selection)].filter(Boolean).join("\n\n")}\n\n`;
}

/**
 * The attribution line, or null when the capture could not name anywhere.
 *
 * The nearest heading above a selection is often the page's own title, so the two arrive equal as
 * often as not — saying it twice would read as a stutter, not as
 * precision.
 */
function whereFrom(selection: Pick<CapturedSelection, "source" | "page">): string | null {
  const heading = selection.source?.trim() || null;
  const page = selection.page?.trim() || null;

  if (!heading) return page && `From ${page}`;
  if (!page || page === heading) return `From ${heading}`;

  return `From ${heading}, on ${page}`;
}

/**
 * Cuts at the last word boundary that fits, and says so.
 *
 * The ellipsis is not decoration: a quote silently missing its last clause is a quote the buddy
 * would answer as though it were whole, and the hire has no way to tell.
 */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut;

  return `${kept.trimEnd()}…`;
}
