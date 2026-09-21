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
/**
 * The colour a PM block is recognised by. Each section has one — Team is brand, Onboarding cyan,
 * Questions indigo, Knowledge gaps pink, Escalations purple — and its cards, figures and chips use
 * it wherever that section shows up, so a glance at a colour says which part of the area a block
 * belongs to. `warning` is not a section: it is what "somebody is waiting on you" looks like.
 */
export type PmTone =
  "brand" | "cyan" | "indigo" | "pink" | "purple" | "warning" | "success" | "neutral";

/** Icon chip in a card header. Brand keeps the gradient every widget in the app uses. */
const TONE_CHIP: Record<PmTone, string> = {
  brand: "bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm",
  cyan: "bg-app-cyan-bg text-app-cyan-text",
  indigo: "bg-app-indigo-bg text-app-indigo-text",
  pink: "bg-app-pink-bg text-app-pink-text",
  purple: "bg-app-purple-bg text-app-purple-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  success: "bg-app-success-bg text-app-success-text",
  neutral: "bg-app-neutral-bg text-app-neutral-text",
};

/** The same tones, soft, for the small chips inside figures and rows. */
const PM_TONE_SOFT: Record<PmTone, string> = {
  brand: "bg-app-brand-soft text-app-brand-text",
  cyan: "bg-app-cyan-bg text-app-cyan-text",
  indigo: "bg-app-indigo-bg text-app-indigo-text",
  pink: "bg-app-pink-bg text-app-pink-text",
  purple: "bg-app-purple-bg text-app-purple-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  success: "bg-app-success-bg text-app-success-text",
  neutral: "bg-app-neutral-bg text-app-neutral-text",
};

/** The corner glow, in the card's own colour. */
const TONE_GLOW: Record<PmTone, string> = {
  brand: "bg-app-brand/10",
  cyan: "bg-app-cyan-text/10",
  indigo: "bg-app-indigo-text/10",
  pink: "bg-app-pink-text/10",
  purple: "bg-app-purple-text/10",
  warning: "bg-app-warning-solid/10",
  success: "bg-app-success-solid/10",
  neutral: "bg-app-brand/5",
};

export function PmCard({
  children,
  className = "",
  as: Element = "section",
  "aria-label": ariaLabel,
  tone = "brand",
  to,
  linkLabel,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  "aria-label"?: string;
  tone?: PmTone;
  /**
   * Makes the whole card a way into its section, not only the small link in the header.
   *
   * Drawn as a link stretched under the content rather than a link around it: the rows inside
   * are links and buttons of their own, and interactive elements cannot nest. The content lets
   * clicks fall through to the stretched link everywhere except on those rows and controls.
   */
  to?: string;
  /** Accessible name of the stretched link, e.g. "Open recurring questions". */
  linkLabel?: string;
}) {
  return (
    <Element
      aria-label={ariaLabel}
      className={`relative overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5 sm:p-6 ${
        to ? "transition-colors hover:border-app-brand-border-strong" : ""
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-2xl ${TONE_GLOW[tone]}`}
      />
      {to && (
        <Link
          to={to}
          aria-label={linkLabel ?? ariaLabel}
          className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none focus-visible:ring-inset"
        />
      )}
      <div
        className={`relative flex h-full flex-col ${
          to ? "pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto" : ""
        }`}
      >
        {children}
      </div>
    </Element>
  );
}

export function PmCardHeader({
  icon: Icon,
  title,
  meta,
  action,
  tone = "brand",
}: {
  icon: LucideIcon;
  title: string;
  tone?: PmTone;
  /** A count or a timestamp beside the title — quiet, never a control. */
  meta?: ReactNode;
  /** One control on the right edge: usually a {@link PmCardLink}. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}
        >
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
  /** A number somebody has to act on. Marks the tile with a dot and a warm chip, never the figure. */
  attention?: boolean;
  /** The section the figure belongs to — colours the icon chip while nothing is waiting. */
  tone?: PmTone;
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
  tone = "brand",
  to,
  onClick,
}: PmStatProps) {
  // One row, not a tall tile: icon, figure, label and hint side by side. The tiles used to be
  // 7rem tall with a 3xl number, which gave four small figures a whole band of the page.
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          attention ? PM_TONE_SOFT.warning : PM_TONE_SOFT[tone]
        }`}
      >
        <Icon className="h-4 w-4" />
        {attention && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-app-warning-solid opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-app-warning-solid ring-2 ring-app-surface" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-xl leading-none font-bold tracking-tight text-app-text tabular-nums">
            {value}
          </span>
          <span className="truncate text-[12.5px] font-medium text-app-text-muted">{label}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-app-text-subtle">{hint}</span>
      </span>
    </>
  );

  const className =
    "flex h-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3 text-left";
  const interactiveClassName = `${className} transition-all hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none motion-reduce:hover:translate-y-0`;

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
 * The first row of a PM section: one line on what it shows, and the section's own controls on
 * the right.
 *
 * The section's name is a heading for assistive technology only. The workspace's tab bar right
 * above already says "Team" in the active pill, and repeating it as a visible title under that
 * — with the page's "PM Dashboard" above both — stacked three headings before any content.
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
        <h2 className="sr-only">{title}</h2>
        <p className="text-sm text-app-text-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
