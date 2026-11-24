import { createPortal } from "react-dom";

/**
 * The folded rail's tooltip: the entry's name and, below it, what is waiting. Hidden from assistive
 * technology: the entry's own name and status already say all of this; the tooltip is the same words
 * for someone who can only see an icon.
 */
export function NavLinkTooltip({
  at,
  label,
  detail,
}: {
  at: { x: number; y: number };
  label: string;
  detail: string | null;
}) {
  return createPortal(
    <span
      aria-hidden="true"
      style={{ left: at.x, top: at.y }}
      className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-app-text shadow-lg"
    >
      {label}
      {detail ? (
        <span className="block text-xs font-normal text-app-text-muted">{detail}</span>
      ) : null}
    </span>,
    document.body,
  );
}
