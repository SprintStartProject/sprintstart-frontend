import { EMPTY_DRAFT, type CardBlueprintDraft } from "../types";
import { extractChecklist } from "../../board/generation/checklistFromMarkdown";
import { HEADING_LIMIT, normalise, truncateAtWord } from "../../board/generation/noteComposition";

/**
 * A blueprint drafted from something a PM highlighted.
 *
 * The knowledge base is where the answers already are, and a PM reading it is the person who knows
 * which paragraph every new backend hire needs in week one. Until now that knowledge went from the
 * page into their head and out again once per hire — the exact loop blueprints exist to close, with
 * no way to get from one to the other except retyping.
 *
 * **A draft, and never a saved blueprint.** A blueprint applies to every hire the roles match, and
 * minting one from a stray highlight would be the app making a decision about people who are not
 * here yet. What this produces is opened in the editor with the stage and the roles still to be
 * chosen — the two fields the selection cannot possibly know.
 */
export function blueprintFromSelection(text: string, source: string | null): CardBlueprintDraft {
  const clean = text.trim();

  // A highlighted list is already the card. The same extraction the buddy's replies go through, so
  // a bulleted paragraph in the knowledge base and a list the mentor wrote become the same card.
  const list = extractChecklist(clean);

  return {
    ...EMPTY_DRAFT,
    title: truncateAtWord(normalise(list?.title ?? firstLine(clean)), HEADING_LIMIT),
    // Where it came from, in the one field of a blueprint that is addressed to the hire. A PM
    // writing this by hand would say the same thing, and having to retype it is how it gets left
    // out.
    description: source ? `From ${source}` : "",
    items: list?.items ?? [],
  };
}

/**
 * The first line, or the whole thing when there is only one.
 *
 * A title, not a summary: what a PM highlighted usually opens with the sentence that names it, and
 * inventing a name from the rest would be the app titling somebody else's card.
 */
function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim().length > 0) ?? text;
}
