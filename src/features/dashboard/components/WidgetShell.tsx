import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Spinner } from "../../../components/ui/Spinner";

export type WidgetShellProps = {
  icon: LucideIcon;
  title: string;
  /**
   * What the card promises when clicked, e.g. "Open team management".
   *
   * Omitted together with {@link WidgetShellProps.to} for a card with nowhere to go.
   */
  actionLabel?: string;
  /**
   * Where clicking the card leads — the page that can act on what it shows.
   *
   * Optional, because not every widget has one: a card whose subject lives behind a route
   * this user may not enter is still worth showing, and sending them to a redirect would be
   * worse than not offering the click at all. Left out, the card renders as plain content
   * with the same frame — no pointer, no hover lift, nothing to focus.
   */
  to?: string;
  isLoading?: boolean;
  /** Shown instead of the body when the figures could not be read. */
  errorMessage?: string | null;
  children: ReactNode;
};

/**
 * The frame the summary widgets share: header, click-through, loading and failure.
 *
 * Exists because a dashboard the user assembles themselves is only calm if the cards agree
 * on where the title sits and what clicking does. Each widget then supplies its figures and
 * nothing else.
 *
 * Deliberately has no nested links: the whole card is the control, and a link inside an
 * interactive card is the nested-interactive problem `ClickableCard` documents.
 */
export function WidgetShell({
  icon: Icon,
  title,
  actionLabel,
  to,
  isLoading = false,
  errorMessage = null,
  children,
}: WidgetShellProps) {
  const navigate = useNavigate();

  const contents = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm font-semibold text-app-text">{title}</span>
        </div>

        {/* The action label steps aside on a narrow card. It is `aria-hidden` and the card's own
                `aria-label` carries the same words, so dropping it costs nothing but the pixels
                — and keeping it cost the whole row: "Open team management" beside a title in a
                quarter-row card ran past the edge and was clipped by the card's `overflow-hidden`.
                A *container* query, not a viewport one: what is short of room is the card, and the
                same card is roomy at half a row on the same screen. */}
        {to !== undefined && (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-app-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-app-brand-text"
          >
            <span className="hidden @min-[20rem]:inline">{actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="relative flex flex-1 items-center justify-center">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : errorMessage ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-app-text-muted" />
          <p className="text-sm text-app-text-muted">{errorMessage}</p>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col">{children}</div>
      )}
    </>
  );

  if (to === undefined) {
    return (
      // No surface of its own: the card's border, background and shadow come from the
      // `SpotlightCard` the dashboard frame wraps every widget in.
      <article className="@container relative flex h-full flex-col overflow-hidden rounded-2xl p-6">
        {contents}
      </article>
    );
  }

  return (
    <ClickableCard
      onClick={() => void navigate(to)}
      aria-label={actionLabel}
      className="group @container relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl p-6 transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {contents}
    </ClickableCard>
  );
}
