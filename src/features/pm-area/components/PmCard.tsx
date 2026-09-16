import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The surface every PM section draws its blocks on.
 *
 * Same frame as the dashboard widgets (`WidgetShell`): a rounded-2xl card, a gradient icon chip
 * beside a small semibold title, the soft brand glow in the corner. The PM area used to wrap
 * whole sections in `SpotlightCard`s with their own `text-lg` headings inside, which made it the
 * one area of the app that looked like a different product.
 */
export function PmCard({
  children,
  className = "",
  as: Element = "section",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  "aria-label"?: string;
}) {
  return (
    <Element
      aria-label={ariaLabel}
      className={`relative overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5 sm:p-6 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />
      <div className="relative flex h-full flex-col">{children}</div>
    </Element>
  );
}

export function PmCardHeader({
  icon: Icon,
  title,
  meta,
  action,
}: {
  icon: LucideIcon;
  title: string;
  /** A count or a timestamp beside the title — quiet, never a control. */
  meta?: ReactNode;
  /** One control on the right edge: usually a {@link PmCardLink}. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
        <h2 className="truncate text-sm font-semibold text-app-text">{title}</h2>
        {meta !== undefined && meta !== null && (
          <span className="shrink-0 text-xs text-app-text-muted tabular-nums">{meta}</span>
        )}
      </div>
      {action}
    </div>
  );
}

export function PmCardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-app-text-muted transition-colors hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** Small uppercase label that opens a group inside a card. */
export function PmEyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[10px] font-semibold tracking-widest text-app-brand-text uppercase ${className}`}
    >
      {children}
    </p>
  );
}

type PmStatProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint: string;
  /** A number somebody has to act on. Tints the icon chip only, never the figure. */
  attention?: boolean;
  /** Makes the tile a link to where the number can be acted on. */
  to?: string;
  onClick?: () => void;
};

/**
 * One headline figure. The row of these is the first thing on every PM page, so a manager
 * reads the same shape — label, number, what it is measured against — wherever they land.
 */
export function PmStat({
  icon: Icon,
  label,
  value,
  hint,
  attention = false,
  to,
  onClick,
}: PmStatProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[12.5px] font-medium text-app-text-muted">{label}</span>
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            attention
              ? "bg-app-warning-bg text-app-warning-text"
              : "bg-app-brand-soft text-app-brand-text"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-auto pt-2 text-2xl font-bold tracking-tight text-app-text tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-app-text-subtle">{hint}</p>
    </>
  );

  const className =
    "flex h-full min-h-28 flex-col rounded-2xl border border-app-border bg-app-surface p-4 text-left sm:p-[18px]";
  const interactiveClassName = `${className} transition-all hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-lg focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none motion-reduce:hover:translate-y-0`;

  if (to) {
    return (
      <Link to={to} className={interactiveClassName}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactiveClassName}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

/**
 * The first row of a PM section: its name, one line on what it shows, and the section's own
 * controls on the right.
 *
 * The controls used to sit in the page header, and each section put different things there —
 * a rebuild button, a rescan button with two timestamps under it — so the header changed
 * height as you moved between them. The header is shared now; what belongs to one section
 * lives in that section.
 */
export function PmSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:min-h-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg leading-tight font-semibold text-app-text">{title}</h2>
        <p className="mt-0.5 text-sm text-app-text-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
