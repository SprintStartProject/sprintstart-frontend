import type { ReactNode } from "react";

/** The width the app branches on for a rail: below it there is no room for a column. */
export const RAIL_DESKTOP_QUERY = "(min-width: 768px)";

/**
 * A standing column beside a conversation — the chat's history, the buddy's PM replies.
 *
 * **One element, two behaviours.** Below `md` it is a drawer that slides in over the
 * conversation; from `md` up it is a column beside it that collapses to nothing. The chat's
 * rail does this by rendering its list twice and hiding one per breakpoint, which puts the
 * same content in the document twice — invisible to anyone looking at the page and a plain
 * duplicate to anything reading it. Switching `position` at the breakpoint gets both
 * behaviours out of one node.
 *
 * `inert` while closed, at *both* widths. A collapsed `w-0 overflow-hidden` column is still
 * focusable — Tab walks into a rail nobody can see, which is the version of this bug that
 * only keyboard users ever meet.
 *
 * The rail stays mounted while it is closed rather than being unmounted: whatever is in it
 * keeps its scroll position and its data, and the count on the control that reopens it is
 * read from the same list the rail is showing.
 *
 * As a drawer it comes with the dimmed backdrop the app's own mobile sidebar has, and for the
 * same reason: a panel covering the page you were reading should close by pressing the page,
 * not only by finding its cross. The backdrop is a `button` rather than a `div` with a click
 * handler, so it is a real control with a name — the same shape, and the same layering
 * (`z-50` under a `z-[60]` panel), as `SideBar`'s.
 */
export function ConversationRail({
  isOpen,
  label,
  id,
  openWidthClassName = "md:w-80",
  onDismiss,
  dismissLabel,
  children,
}: {
  isOpen: boolean;
  /** Names the region for assistive tech — it has no visible heading of its own. */
  label: string;
  /** For the `aria-controls` of whatever opens it. */
  id?: string;
  /** How wide the column is at `md` and up. The drawer's width is fixed. */
  openWidthClassName?: string;
  /**
   * Closes the drawer from the backdrop. Only ever called below `md`: from there up the rail
   * is a column beside the conversation, there is nothing covering the page, and pressing the
   * conversation has to put the caret in it rather than put the rail away.
   */
  onDismiss?: () => void;
  /** What the backdrop is called. Say the same thing the panel's own close control says. */
  dismissLabel?: string;
  children: ReactNode;
}) {
  return (
    <>
      {isOpen && onDismiss && (
        <button
          type="button"
          aria-label={dismissLabel ?? `Close ${label}`}
          onClick={onDismiss}
          className="fixed inset-0 z-50 bg-app-overlay backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        id={id}
        aria-label={label}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={[
          "fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[85vw] flex-col",
          "border-r border-app-border bg-app-bg-soft shadow-2xl",
          "transition-transform duration-300",
          // From `md` the insets and the shadow stop applying and the width does the work.
          "md:static md:z-auto md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none",
          "md:transition-[width] md:duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isOpen ? openWidthClassName : "md:w-0 md:overflow-hidden md:border-r-0",
        ].join(" ")}
      >
        {children}
      </aside>
    </>
  );
}

/**
 * The control that brings a closed {@link ConversationRail} back.
 *
 * Floats over the top-left corner of the conversation rather than sitting in a bar, for the
 * reason the chat's does: the page header is shared with the other half of the assistant, and
 * a strip under it holding one button would be a second header.
 *
 * The count is not decoration. This is the only thing on screen saying the rail has anything
 * in it, and "your PM answered" is the whole promise the escalation flow makes.
 */
export function RailToggle({
  label,
  icon,
  count,
  controls,
  onClick,
}: {
  /** Used as both the accessible name and the tooltip — there is no visible label. */
  label: string;
  icon: ReactNode;
  count?: number;
  controls?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-controls={controls}
      // Constant, and true: this control only exists while the rail is collapsed. Saying so is
      // what tells a screen reader that pressing it opens something rather than navigating.
      aria-expanded={false}
      title={label}
      onClick={onClick}
      className="absolute top-3 left-2 z-30 flex shrink-0 items-center gap-1.5 rounded-xl border border-app-border bg-app-surface p-2 text-app-text-muted shadow-sm transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {icon}

      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-app-brand-soft px-1.5 text-[11px] font-semibold text-app-brand-text tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
