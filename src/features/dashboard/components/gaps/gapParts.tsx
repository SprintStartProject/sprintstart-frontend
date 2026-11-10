import { SEVERITY_STYLES } from "./gapsKit";
import type { KnowledgeGap } from "./gapsKit";

/**
 * What the component is missing, as chips.
 *
 * The document types are the actionable half of a gap — "runbook" says what to write, where
 * "high severity" only says how much it matters — so they survive at every size, and it is
 * how many of them are shown that gives way instead.
 */
export function MissingTypes({
  types,
  limit,
  tone = "missing",
}: {
  types: readonly string[];
  limit: number;
  /** `present` is the green counterpart used for what the component already has. */
  tone?: "missing" | "present";
}) {
  const visible = types.slice(0, limit);
  const hidden = types.length - visible.length;

  const chip =
    tone === "present"
      ? "rounded border border-app-success-border bg-app-success-bg px-1.5 py-0.5 text-xs text-app-success-text"
      : "rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-xs text-app-text-muted";

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((type) => (
        <span key={type} className={chip}>
          {type}
        </span>
      ))}

      {hidden > 0 && <span className={chip}>+{hidden}</span>}
    </div>
  );
}

/** Small uppercase caption over a chip group. */
export function ChipLabel({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-2xs font-semibold tracking-wider text-app-brand-text uppercase">
      {children}
    </p>
  );
}

/*
  The feature's own pill rather than `ui/Badge`: severity is a four-step ramp on its own
  scale, not a point on the app's status ladder, so no Badge variant carries the right
  colour. Mapping the steps onto the nearest status roles would have put this pill and the
  `SeverityBar` beside it in two different reds for the same gap. Same markup as the pills
  on the knowledge-gaps pages.
*/
export function SeverityPill({ gap }: { gap: KnowledgeGap }) {
  const { badge, label } = SEVERITY_STYLES[gap.severity];

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
      {label}
    </span>
  );
}

/**
 * The "there is something new here" marker, and the only thing that clears it.
 *
 * Not a button: the whole card is the control (see `WidgetShell`), so pressing anywhere on it
 * is what acknowledges the marker. That is also why the card is made pressable for a user who
 * has nowhere to go from here -- clearing the marker is a worthwhile outcome on its own, and
 * it is the one the sidebar flag is waiting for.
 *
 * Purely visual, and it has to be: `ClickableCard` renders the card as `role="button"`, which
 * ARIA treats as children-presentational, so anything said in here is never reached -- the
 * card's own `aria-label` is the only text a screen reader gets. The count therefore lives in
 * that label rather than in an `sr-only` span nobody would hear.
 */
export function NewOwnershipPill() {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-app-warning-border bg-app-warning-bg px-2 py-0.5 text-2xs font-semibold tracking-wide text-app-warning-text uppercase"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-app-warning-solid" />
      New
    </span>
  );
}

/** Trailing line for whatever did not fit, so the list never just stops. */
export function HiddenCount({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null;

  return <p className="mt-2 text-xs text-app-text-muted">and {hidden} more assigned to you</p>;
}
