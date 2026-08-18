import { Plus } from "lucide-react";
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

export type AddWidgetModalProps = {
  isOpen: boolean;
  /** Widgets not currently on the board. An empty list means everything is already placed. */
  widgets: DashboardWidgetDefinition[];
  onAdd: (id: DashboardWidgetId) => void;
  onClose: () => void;
};

/**
 * The widget picker.
 *
 * Only ever lists what this user may actually have — the catalog's availability check runs
 * before the grouping, so a PM never sees an organization section teasing widgets that would
 * 403. The headings group by audience rather than by permission, because "your team" is what
 * the reader is choosing between; whether they are allowed is already settled.
 *
 * Adding closes the dialog: the point of the picker is the card appearing on the board
 * behind it, and leaving it open hides the result of the click.
 */
export function AddWidgetModal({ isOpen, widgets, onAdd, onClose }: AddWidgetModalProps) {
  const groups = TIER_HEADINGS.map((heading) => ({
    ...heading,
    widgets: widgets.filter((widget) => widget.tier === heading.tier),
  })).filter((group) => group.widgets.length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a widget"
      description="Everything available to you. Widgets already on your dashboard are not listed."
      size="lg"
      testId="add-widget-modal"
    >
      {groups.length === 0 ? (
        <p className="text-sm text-app-text-muted">
          Every widget available to you is already on your dashboard.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.tier} aria-label={group.label}>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-app-text">{group.label}</h3>
                <p className="text-xs text-app-text-muted">{group.hint}</p>
              </div>

              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.widgets.map((widget) => {
                  const Icon = widget.icon;

                  return (
                    <li
                      key={widget.id}
                      className="flex items-start gap-3 rounded-xl border border-app-border-muted bg-app-surface-muted p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text"
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-app-text">{widget.title}</p>
                        <p className="mt-0.5 text-xs text-app-text-muted">{widget.description}</p>
                        <p className="mt-1 text-xs text-app-text-subtle">
                          Added as {DASHBOARD_SIZE_LABELS[widget.defaultSize].toLowerCase()}
                        </p>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        iconOnly
                        aria-label={`Add ${widget.title}`}
                        onClick={() => {
                          onAdd(widget.id);
                          onClose();
                        }}
                        icon={<Plus className="h-4 w-4" />}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
