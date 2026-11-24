import { cardAccent } from "./cardAccents";
import { cardIcon } from "./cardIcons";
import type { CardStack } from "./cardStacks";

/**
 * The rest of the pile, showing under the card that is standing in for it.
 *
 * Real card edges rather than a hint of one: the same surface, border and shadow an actual card
 * wears, inset and pushed down so what you see below the top card is unmistakably *another card*.
 *
 * **Hovering fans them out and names them.** That is the moment somebody is deciding whether there
 * is anything under this card, and "there are two more" is a worse answer than "next is *Set up
 * your machine*, then *Read the runbook*". So the fan is not decoration: each sheet slides and
 * swings far enough to show a strip carrying that card's own glyph and title, and the strip is a
 * button that opens the pile at that card. A pile that only ever admitted to a count made you open
 * it to find out whether it was worth opening.
 *
 * They rotate about their top edge, so the swing happens at the bottom where it is visible and the
 * hidden top stays hidden behind the card — a hand of cards being fanned, which is the picture
 * everybody already has for "there are more of these".
 *
 * **Both turn the same way, each a little further than the one above it**, so the pile splays open
 * to the left and the deepest sheet is the one lying lowest. Opposite angles made the two sheets
 * lean away from each other, which is a splay rather than a fan: nothing about it says which of
 * them is further down the run. Turning them the same way makes the depth the thing the shape is
 * about — and it puts the low corner on the same side as the strips' own text, which starts at the
 * left. The angles stay small because those strips carry words: past about five degrees a fan stops
 * reading as a fan and starts reading as text that did not line up.
 *
 * **The tones step back with the sheets.** The nearest sheet takes the brand fill and the strong
 * border the card itself takes on hover; the one behind it takes a lighter wash of the same colour.
 * Depth is the thing being drawn, and two sheets highlighted identically read as one wide sheet.
 * Pointing at a particular strip promotes *that* one to the strong tone, so the fan answers the
 * pointer the way a list of rows does — whichever card you are about to open is the lit one.
 */
export const STACK_SHEETS = [
  {
    /**
     * The next card: its strip sits directly under the top card, and it is the one the pile is
     * about, so it takes the same strong tone the card itself takes.
     *
     * `peer-hover/deep` is the other half of the trade. The deeper sheet is drawn first and is
     * therefore this one's *earlier* sibling, so it can say "somebody is pointing at me" — and
     * when they are, this one steps back to the light tone. Whichever strip is under the pointer
     * is the lit one, in both directions.
     */
    box: "inset-x-3 top-2 -bottom-2 motion-safe:group-hover/stack:-bottom-6 motion-safe:group-hover/stack:-rotate-[1.2deg]",
    tone: "group-hover/stack:border-app-brand-border-strong group-hover/stack:bg-app-brand-soft peer-hover/deep:border-app-brand-border peer-hover/deep:bg-app-brand-soft/50",
  },
  {
    /** The one after it: half a step further out, further down, and turned further the same way. */
    box: "peer/deep inset-x-6 top-4 -bottom-3 motion-safe:group-hover/stack:-bottom-12 motion-safe:group-hover/stack:-rotate-[2.5deg]",
    tone: "group-hover/stack:border-app-brand-border group-hover/stack:bg-app-brand-soft/50",
  },
];

/**
 * The room a fanned pile takes under it, by how many sheets it has.
 *
 * Real space rather than an overlap. The first cut let the deeper sheet lie over whatever was below
 * it on the theory that a hover is momentary — which was wrong twice over. It looked like the pile
 * was lying on the next card, and it could not even do that cleanly: every block in a column
 * carries its own opacity and transform for the entrance animation, so each is its own stacking
 * context and they paint in document order. A `z-index` on a sheet cannot lift it above the *next*
 * card however high it is set; the fan went *under* the card below and came out as torn edges.
 *
 * **But it is only taken while the fan is out.** Holding 56px of empty page under every pile for a
 * strip nobody is looking at is a tax on the whole board for a moment that lasts as long as a
 * pointer rests. So the margin grows on hover instead, on the same curve and over the same 300ms
 * as the sheets themselves: the cards below drift down a little, the fan opens into the space they
 * left, and both go back when the pointer leaves. The board answering the gesture *is* the effect
 * — a pile that pushes its neighbours aside to be read looks like something being lifted out of a
 * stack, which is what it is.
 *
 * At rest a little is still claimed. The column's own 16px gap technically *covers* the 8 and 12
 * pixels the resting sheets show, but covering is not the same as looking right: a pile whose
 * bottom edge stops four pixels short of the next card reads as two cards that have been pushed
 * into each other, not as one card with something behind it. So a resting pile keeps a few pixels
 * of its own — enough that the edges under it are edges rather than a collision. Only piles that
 * have that many sheets take the room, and an ordinary card takes none.
 *
 * **The numbers are the sheet's depth plus what turning it costs**, and the second part is bigger
 * than it looks. A sheet rotates about its top edge, so its low corner drops by half the card's
 * width times the sine of the angle — a few pixels on a card in a two-column layout, twice that on
 * the same card at full width on a phone. The deepest sheet sits 48px out and can be another 13
 * below that, and its shadow is drawn below *that* again. So the room is the depth rounded
 * generously up rather than the depth exactly: measured to the pixel it is right on the layout it
 * was measured on and a hair short everywhere else, which is what "it still overlaps a little"
 * looks like.
 *
 * It also has to *beat* the gaps around it rather than match them. This margin does not add to the
 * space below the card, it collapses with it — a 64px fan margin under a 40px band gap leaves 64px
 * in total, not 104. Set close to the fan's real reach, the two numbers cancel out to almost
 * nothing and the last pile in a band still touches the heading below it. So the room is set well
 * clear of anything it might collapse against.
 */
export const FAN_ROOM = ["", "pb-4 motion-safe:hover:pb-14", "pb-6 motion-safe:hover:pb-24"];

/**
 * What pointing straight at a strip does, whichever depth it is drawn at.
 *
 * Marked important on purpose. This has to beat both the group's tone and the peer's step-back,
 * and which of three same-specificity variants wins would otherwise come down to the order Tailwind
 * happens to emit them in — a rule that is right today and silently inverts on an upgrade.
 */
export const SHEET_HOVERED = "hover:border-app-brand-border-strong! hover:bg-app-brand-soft!";

/** A card lying under the one standing in for its pile, as the fanned sheet names it. */
export type BehindSheet = {
  id: string;
  name: string;
  Icon: ReturnType<typeof cardIcon>;
  accent: ReturnType<typeof cardAccent>;
};

/**
 * The cards behind this one, nearest first — the ones the fanned sheets name.
 *
 * Everything after the card standing on top, which is by construction what is still to do in the
 * run. Two at most, because there are two sheets: a third strip would be a card the eye has to
 * work to read on a pile that is already asking for a click.
 */
export function sheetsBehind(stack: CardStack | undefined, pinned: boolean): BehindSheet[] {
  if (!stack) return [];

  const top = stack.memberIds.indexOf(stack.topId);

  // A pinned card can stand on top from anywhere in the pile, the last place included. Then the
  // cards before it fill in after the ones that follow it, so a pile topped by its last card
  // still shows what lies under it. Unpinned, the cards before the top are the finished ones and
  // stay out of the sheets as before.
  const after = stack.memberIds.slice(top + 1);
  const others = pinned ? [...after, ...stack.memberIds.slice(0, top)] : after;

  // Named from the stack, not from the board: these cards are folded away, so they are not in
  // the list this grid was handed.
  return others.slice(0, STACK_SHEETS.length).map((memberId) => {
    const member = stack.members.get(memberId);

    return {
      id: memberId,
      name: member?.name ?? "The next card",
      Icon: cardIcon(member?.kind ?? "NOTE"),
      // The kind's own ink, the same as the card would wear if it were open. A closed pile is
      // the one place the board says what is underneath without drawing it, and in one grey it
      // said "two more cards" where it can just as easily say which two.
      accent: cardAccent(member?.kind ?? "NOTE"),
    };
  });
}
