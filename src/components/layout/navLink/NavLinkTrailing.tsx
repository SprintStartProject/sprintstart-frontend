import { countText } from "./navLinkText";

type NavLinkTrailingProps = {
  busy: boolean;
  busyLabel?: string;
  count: number;
  countLabel?: (count: number) => string;
  isHighlighted: boolean;
  collapsed: boolean;
};

function BusySpinner({
  busyLabel,
  isHighlighted,
  collapsed,
}: Pick<NavLinkTrailingProps, "busyLabel" | "isHighlighted" | "collapsed">) {
  return (
    <span
      className={collapsed ? "absolute -top-1 -right-1 flex" : "ml-auto flex items-center"}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`h-[14px] w-[14px] rounded-full border-2 border-t-transparent motion-safe:animate-spin ${
          isHighlighted ? "border-white" : "border-app-brand"
        }`}
      />
      <span className="sr-only">{busyLabel ?? "In progress"}</span>
    </span>
  );
}

function CountBubble({
  count,
  countLabel,
  collapsed,
}: Pick<NavLinkTrailingProps, "count" | "countLabel" | "collapsed">) {
  return (
    // Folded to icons, the count sits on the icon's corner. Its words (what a screen reader hears)
    // are its tooltip, since a bare number does not say of what.
    <span
      className={
        collapsed ? "absolute -top-2 -right-2.5 flex items-center" : "ml-auto flex items-center"
      }
      // Open, the link's own `title` (name and chord) must not be shadowed by it.
      title={collapsed ? countLabel?.(count) : undefined}
    >
      {/* The same amber as the icon beside it, and the same amber on the active row as off it. This
          is the second half of one signal, not a badge of its own. */}
      <span
        aria-hidden="true"
        className="min-w-[20px] rounded-full bg-app-warning-bg px-1.5 py-0.5 text-center text-xs font-semibold text-app-warning-text"
      >
        {count}
      </span>
      <span className="sr-only">{countText(count, countLabel)}</span>
    </span>
  );
}

/**
 * One trailing slot, not two. Busy first, then the count: a number and the active dot side by side
 * read as two separate signals about the same row, and the row you are already on has less to tell
 * you than the one with work waiting behind it.
 */
export function NavLinkTrailing(props: NavLinkTrailingProps) {
  if (props.busy) return <BusySpinner {...props} />;
  if (props.count > 0) return <CountBubble {...props} />;
  if (props.isHighlighted && !props.collapsed) {
    return <span className="ml-auto h-[6px] w-[6px] rounded-full bg-white" />;
  }
  return null;
}
