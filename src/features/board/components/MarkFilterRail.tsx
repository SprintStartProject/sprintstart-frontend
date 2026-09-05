import { HIGHLIGHT_CLASS } from "../marks/highlightColors";
import type { SectionSummary } from "../layout/boardSections";

type MarkFilterRailProps = {
  /** The colour cuts worth offering — one per colour this board actually has marks in. */
  sections: SectionSummary[];
  /** The section being shown; null is "everything". */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/**
 * The highlight colours, as switches, in the rail with the board's other switches.
 *
 * They started in the section bar, beside the areas, and that was the wrong shelf twice over. An
 * area is somewhere a card *is* filed; a colour is something the hire drew on it while reading, and
 * the two do not belong in one list of "parts of the board". The bar is also a bar of names, so a
 * colour arrived there as a word — which then had to be a word worth reading, which is how naming
 * the colours ended up as a legend nobody had asked for sitting above the cards.
 *
 * Here it is a dot, and a dot needs no name. Pressing one shows what is marked in that colour;
 * pressing it again shows everything — the same behaviour as the provenance filter it sits under,
 * and nothing like the tabs it left. The hire's own word for a colour, where they have written one,
 * is the button's label for a pointer and for a screen reader: the one place a name is genuinely
 * useful, and the one place it costs no room.
 *
 * Draws nothing until something is highlighted. Four dots over a board with no marks would be a
 * control for something that has not happened yet.
 */
export function MarkFilterRail({ sections, selectedId, onSelect }: MarkFilterRailProps) {
  if (sections.length === 0) return null;

  return (
    <>
      <span className="my-0.5 h-px w-6 bg-app-border" aria-hidden="true" />

      <div
        className="flex flex-col items-center gap-1"
        role="group"
        aria-label="Show what you highlighted"
      >
        {sections.map((section) => {
          const active = section.id === selectedId;
          const label = `${section.name} · ${section.total} ${section.total === 1 ? "card" : "cards"}`;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(active ? null : section.id)}
              aria-pressed={active}
              aria-label={label}
              title={label}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                active ? "bg-app-surface-hover" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-3.5 w-3.5 rounded-full border transition-transform ${
                  section.mark ? HIGHLIGHT_CLASS[section.mark] : ""
                } ${
                  active
                    ? "scale-110 border-app-text ring-2 ring-app-text ring-offset-1 ring-offset-app-surface"
                    : "border-app-border"
                }`}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
