/**
 * The colours a hire may paint one of their own areas.
 *
 * The board already colours *cards* by kind, and that colour is a wayfinding aid nobody chose. An
 * area's colour is the opposite: it means whatever the person who picked it decided it means —
 * "the stuff I'm blocked on", "the reading", "week one" — and that is exactly why free choice is
 * right here and wrong on a card. One colour per named group, chosen deliberately, is a legend the
 * person wrote themselves; a colour per card would be a paint chart, and would drown out the kinds.
 *
 * **Four, and none of them green or red.** `success`, `warning` and `danger` carry a fixed meaning
 * everywhere else in the app (AGENTS.md §7), and an area somebody tinted green because they like
 * green would read as an area that is *going well* — a claim the board cannot make and did not
 * mean. The same reasoning keeps them out of {@link cardAccent}.
 *
 * Stored on the group, so it survives with the rest of the area. An area written before there were
 * colours has none and gets the default, which is the blue every area used to be.
 */
export type AreaAccent = "blue" | "purple" | "amber" | "grey";

export const AREA_ACCENTS: readonly AreaAccent[] = ["blue", "purple", "amber", "grey"];

type AreaAccentStyle = {
  /** What a person calls this colour when they pick it. */
  label: string;
  /** The area's own frame: border and tint. */
  box: string;
  /** Ink for the area's name. */
  title: string;
  /** The swatch in the picker, unselected. */
  swatch: string;
};

const STYLES: Record<AreaAccent, AreaAccentStyle> = {
  blue: {
    label: "Blue",
    box: "border-app-brand-border bg-app-brand-soft",
    title: "text-app-brand-text",
    swatch: "bg-app-brand",
  },
  purple: {
    label: "Purple",
    box: "border-app-purple-border bg-app-purple-bg",
    title: "text-app-purple-text",
    swatch: "bg-app-purple-text",
  },
  amber: {
    label: "Amber",
    box: "border-app-orange-border bg-app-orange-bg",
    title: "text-app-orange-text",
    swatch: "bg-app-orange-text",
  },
  grey: {
    label: "Grey",
    box: "border-app-neutral-border bg-app-neutral-bg",
    title: "text-app-text",
    swatch: "bg-app-neutral-text",
  },
};

/** How an area is painted. Falls back to the blue every area wore before there was a choice. */
export function areaAccent(accent: AreaAccent | undefined): AreaAccentStyle {
  return STYLES[accent ?? "blue"];
}

/** Whether a stored value is one of the colours, so hand-edited storage cannot paint nonsense. */
export function isAreaAccent(value: unknown): value is AreaAccent {
  return typeof value === "string" && (AREA_ACCENTS as readonly string[]).includes(value);
}
