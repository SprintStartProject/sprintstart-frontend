import { CircleCheckBig, CircleSlash, FolderOpen, Layers, Lock } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { ALL_SECTIONS, LOOSE_SECTION, type SectionSummary } from "../layout/boardSections";
import { STAGE_LABELS } from "../layout/boardStructure";

type BoardSectionTabsProps = {
  sections: SectionSummary[];
  /** The selected section's id; null is "everything". */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/**
 * The board's table of contents, as the app's one segmented bar.
 *
 * Borrowed, deliberately, from the way a notebook is organised — named sections, one open at a
 * time. A board of forty cards is not a board anybody scrolls; it is a board somebody gives up on.
 * Naming the parts and showing one at a time turns "forty things" into "six things, and five more
 * sets I know are there" — the same amount of work, a completely different amount of dread.
 *
 * **A bar rather than a side rail.** A rail meant a second navigation column beside the app's own,
 * and on this page it had to fight the 10rem page gutter for its place; more to the point, the app
 * already has one control for switching between named sections, and every other view uses it. The
 * bar scrolls sideways when the sections outgrow it, which is also what makes it right on a phone
 * without a second component for the purpose.
 *
 * Each tab carries the number of cards **still to do** in that section, because that is the number
 * somebody is choosing between sections on. Everything else about the open section — how much is
 * finished, what is waiting, when it is due — sits on one quiet line underneath, where it can be
 * read without being crammed into a tab.
 */
export function BoardSectionTabs({ sections, selectedId, onSelect }: BoardSectionTabsProps) {
  const options: SegmentedTabOption<string>[] = sections.map((section) => {
    const complete = section.total > 0 && section.done === section.total;
    const Icon = complete
      ? CircleCheckBig
      : section.id === null
        ? Layers
        : section.id === LOOSE_SECTION
          ? CircleSlash
          : FolderOpen;

    return {
      value: section.id ?? ALL_SECTIONS,
      label: section.name,
      icon: <Icon className="h-4 w-4" aria-hidden="true" />,
      // Omitted when there is nothing left: a "0" badge beside a tick is the same fact twice, and
      // the tick is the one that reads at a glance.
      count: complete ? undefined : section.total - section.done,
    };
  });

  const selected = sections.find((section) => section.id === selectedId) ?? sections[0];

  return (
    <div className="space-y-2">
      <SegmentedTabs
        value={selectedId ?? ALL_SECTIONS}
        options={options}
        onChange={(value) => onSelect(value === ALL_SECTIONS ? null : value)}
        layoutId="board-section-pill"
        ariaLabel="Which section of the board to show"
      />

      {selected && (
        <p className="flex flex-wrap items-center gap-2 px-1 text-xs text-app-text-muted">
          <span className="tabular-nums">
            {selected.done}/{selected.total} done
          </span>

          {selected.blocked > 0 && (
            <Badge variant="neutral" size="sm" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" />
              {selected.blocked} waiting on something else
            </Badge>
          )}

          {selected.stage && (
            <Badge variant={selected.stage === "NOW" ? "brand" : "neutral"} size="sm">
              {STAGE_LABELS[selected.stage].title}
            </Badge>
          )}
        </p>
      )}
    </div>
  );
}
