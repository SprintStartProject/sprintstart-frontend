import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DASHBOARD_SIZE_LABELS } from "../layout/sizes";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetTier,
} from "../layout/types";

/** Section headings for the picker, in the order the groups are shown. */
const TIER_HEADINGS: readonly { tier: DashboardWidgetTier; label: string; hint: string }[] = [
  { tier: "user", label: "For you", hint: "Your own work" },
  { tier: "manager", label: "Your team", hint: "The project you manage" },
  { tier: "admin", label: "Organization", hint: "Everything, across every project" },
];

/** What this widget is about to become, relative to the board the dialog was opened over. */
type PendingChange = "adding" | "removing" | "placed" | "absent";

function pendingChange(isSelected: boolean, wasPlaced: boolean): PendingChange {
  if (isSelected) return wasPlaced ? "placed" : "adding";

  return wasPlaced ? "removing" : "absent";
}

/** What each state is called, in the chip and — the same words — in the accessible name. */
const CHANGE_LABELS: Record<Exclude<PendingChange, "absent">, string> = {
  adding: "Adding",
  removing: "Removing",
  placed: "On your dashboard",
};

export type WidgetPickerModalProps = {
  isOpen: boolean;
  /** Everything this user may have, placed or not — the picker shows the whole catalog. */
  widgets: DashboardWidgetDefinition[];
  /** What is on the board right now: the starting selection, and the baseline for the diff. */
  placedIds: ReadonlySet<DashboardWidgetId>;
  /** Applies the whole selection at once. Called on save, never on a tick. */
  onApply: (ids: ReadonlySet<DashboardWidgetId>) => void;
  onClose: () => void;
};

/**
 * The widget picker: everything available, what is on the board, and what you are about to
 * change.
 *
 * It used to list only what was *missing* and add one card per click, which asked the reader to
 * hold their current dashboard in their head to make sense of the list — "have I got that one
 * already?" is not a question a picker should raise. Showing the whole catalog with the placed
 * ones ticked answers it by being the answer.
 *
 * **Deliberately the one place in this feature with a save button.** Everything else in edit
 * mode writes through immediately, because each change is one small thing the user is looking
 * straight at. This is a multi-select over a dialog that covers the board: applying per tick
 * would rearrange something nobody can see, and four ticks would be four separate things to
 * undo. So the selection is a draft until it is saved, and closing without saving changes
 * nothing.
 *
 * The draft is also what makes the diff possible. Each card says whether it is being added,
 * being removed, or was already there — in words and an icon, never colour alone — and the
 * footer counts it up, so the reader can see what they have done before committing to it.
 *
 * Only ever lists what this user may actually have: the catalog's availability check runs
 * before the grouping, so a PM never sees an organization section teasing widgets that would
 * 403. The headings group by audience rather than by permission, because "your team" is what
 * the reader is choosing between; whether they are allowed is already settled.
 */
export function WidgetPickerModal({
  isOpen,
  widgets,
  placedIds,
  onApply,
  onClose,
}: WidgetPickerModalProps) {
  const [selected, setSelected] = useState<ReadonlySet<DashboardWidgetId>>(placedIds);

  // Every opening starts from the board as it is now. React's documented "adjust state when a
  // prop changes" pattern rather than an effect, so the dialog's first paint already has the
  // right ticks instead of showing the last visit's draft for a frame. It stays mounted while
  // closed — `Modal` animates its own exit — so this cannot be left to a remount.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSelected(placedIds);
  }

  const groups = TIER_HEADINGS.map((heading) => ({
    ...heading,
    widgets: widgets.filter((widget) => widget.tier === heading.tier),
  })).filter((group) => group.widgets.length > 0);

  const adding = [...selected].filter((id) => !placedIds.has(id)).length;
  const removing = [...placedIds].filter((id) => !selected.has(id)).length;
  const hasChanges = adding > 0 || removing > 0;

  function toggle(id: DashboardWidgetId) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);

      return next;
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Your widgets"
      description="Everything available to you. Tick what you want on your dashboard."
      size="lg"
      // Eleven cards in three sections is taller than the viewport. Scrolling the list rather
      // than the dialog keeps the summary and the save button in reach the whole way down.
      bodyClassName="max-h-[60vh] overflow-y-auto px-7 py-6"
      footerClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      testId="widget-picker-modal"
      footer={
        <>
          <p
            data-testid="widget-picker-summary"
            aria-live="polite"
            className="text-sm text-app-text-muted"
          >
            {hasChanges ? summarize(adding, removing) : "Nothing changed yet."}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>

            <Button
              variant="primary"
              // Nothing to save is not an error worth explaining: the summary beside it
              // already says why the button is offering nothing.
              disabled={!hasChanges}
              onClick={() => {
                onApply(selected);
                onClose();
              }}
            >
              Save changes
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.tier} aria-label={group.label}>
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-app-text">{group.label}</h3>
              <p className="text-xs text-app-text-muted">{group.hint}</p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.widgets.map((widget) => (
                <li key={widget.id}>
                  <WidgetOption
                    widget={widget}
                    isSelected={selected.has(widget.id)}
                    change={pendingChange(selected.has(widget.id), placedIds.has(widget.id))}
                    onToggle={() => toggle(widget.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/** "Adding 2, removing 1." — the same two numbers the cards carry one at a time. */
function summarize(adding: number, removing: number): string {
  const parts: string[] = [];
  if (adding > 0) parts.push(`adding ${adding}`);
  if (removing > 0) parts.push(`removing ${removing}`);

  const sentence = parts.join(", ");

  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * One widget in the picker: a toggle, not a command.
 *
 * `aria-pressed` rather than a checkbox role, because that is what the whole card is — a button
 * whose two states are "on my dashboard" and "not". The description is attached through
 * `aria-describedby` rather than left in the name, so a screen reader does not re-read the
 * blurb every time the state flips.
 *
 * The change chip is described rather than named, and that is the whole reason it is wired up at
 * all: `aria-label` overrides the entire subtree, so the chip was invisible to anything not
 * looking at the card — and `aria-pressed` alone says ticked or not, which is the one distinction
 * this dialog exists *not* to stop at. Ticked because it has been on the board for a month and
 * ticked ten seconds ago are the same state and different news. In the description and not in the
 * name, because the name has to stay put while the button is being pressed: a control that
 * renames itself on activation reads as a different control.
 */
function WidgetOption({
  widget,
  isSelected,
  change,
  onToggle,
}: {
  widget: DashboardWidgetDefinition;
  isSelected: boolean;
  change: PendingChange;
  onToggle: () => void;
}) {
  const Icon = widget.icon;
  const descriptionId = `widget-option-${widget.id}-description`;
  const changeId = `widget-option-${widget.id}-change`;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={widget.title}
      // The chip joins the blurb in the description when there is one to report, which is what
      // gets it past the `aria-label` above.
      aria-describedby={change === "absent" ? descriptionId : `${descriptionId} ${changeId}`}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        isSelected
          ? "border-app-brand bg-app-brand-soft/40"
          : "border-app-border-muted bg-app-surface-muted hover:border-app-border"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text"
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app-text">{widget.title}</span>
        <span id={descriptionId} className="mt-0.5 line-clamp-2 block text-xs text-app-text-muted">
          {widget.description}
        </span>
        <span className="mt-0.5 block text-xs text-app-text-subtle">
          {DASHBOARD_SIZE_LABELS[widget.defaultSize]} by default
        </span>

        <ChangeChip id={changeId} change={change} />
      </span>

      {/* The tick, so "which of these am I keeping" is answerable at a glance rather than by
          reading every chip. Shape as well as colour: an empty ring is not a filled one. */}
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          isSelected
            ? "border-app-brand bg-app-brand text-white"
            : "border-app-border bg-app-surface"
        }`}
      >
        {isSelected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

/**
 * What is about to happen to this widget, in words and a shape.
 *
 * The point of the whole dialog, really: without it a ticked card looks the same whether it has
 * been on the dashboard for a month or was ticked ten seconds ago, which is exactly the "have I
 * got that one already?" the picker used to leave the reader with. Never colour alone — each
 * state carries its own icon and its own word.
 */
function ChangeChip({ id, change }: { id: string; change: PendingChange }) {
  if (change === "absent") return null;

  const chips = {
    adding: { icon: Plus, className: "bg-app-success-bg text-app-success-text" },
    removing: { icon: Minus, className: "bg-app-danger-bg text-app-danger-text" },
    placed: { icon: Check, className: "text-app-text-subtle" },
  } as const;

  const { icon: ChipIcon, className } = chips[change];
  const label = CHANGE_LABELS[change];

  return (
    <span
      id={id}
      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${className}`}
    >
      <ChipIcon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
