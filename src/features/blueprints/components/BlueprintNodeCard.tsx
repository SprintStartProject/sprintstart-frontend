import { KeyRound, type LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge.tsx";
import { GRAPH_NODE_HEIGHT, compactTitlePx } from "../../graph-diagram/graphLayout.ts";
import type { BlueprintGraphCanvasNodeProps } from "./BlueprintGraphCanvas.tsx";

export type BlueprintNodeCardProps = BlueprintGraphCanvasNodeProps & {
  title: string;
  /**
   * What kind of thing this is — a phase, a step, a knowledge check.
   *
   * Always a word and an icon, never a colour on its own: the three kinds have to stay apart for
   * someone who cannot tell the chips' colours apart.
   */
  kind: { label: string; icon: LucideIcon };
  /** Where the node stands, on the surfaces that have a state to show (the hire's read-only view). */
  status?: { label: string; variant: BadgeVariant; icon?: LucideIcon };
  /** One line under the title. Dropped at compact detail, where there is no room to read it. */
  meta?: string | null;
  /** True when this node is the one the surrounding page is currently about. */
  highlighted?: boolean;
  /**
   * Skill or project-role gates on this node, named.
   *
   * The second kind of lock in this model, and the one the canvas used to draw nothing for: a phase
   * gated behind "has Docker" looked exactly like one anybody can start. An arrow says *when*
   * something opens; a requirement says *for whom* — both close a node, so both belong on it.
   */
  requirements?: { label: string; type: "SKILL" | "PROJECT_ROLE" }[];
};

/**
 * The one card every Blueprint graph draws its nodes with.
 *
 * There were three of these — one in the path editor, one in the sub-graph editor, one in the
 * hire's read-only viewer — that had drifted into three different paddings, two icon sizes and
 * three ideas of what a badge says. They are the same object seen from three places, so they are
 * one component with a `kind` and an optional `status`.
 *
 * **Two states, not one shrunk.** Zoomed in, the card is a card: title, a line of context, chips.
 * Zoomed out it becomes a map label — the title alone, sized against the zoom so it stays legible,
 * and the status as a word rather than a chip whose border and padding would be sub-pixel anyway.
 * Scaling the full card down instead is what made the graph unreadable at the zoom where all of it
 * fit, which is the only zoom most people look at it from.
 *
 * The card is a `<button>` rather than a `div` with `role="button"`: it is reached by Tab, opened
 * by Enter or Space, and gets the focus ring for free. It does exactly one thing — open this node's
 * details — and the canvas puts the "drill into its sub-graph" control beside it rather than inside,
 * because a button inside a button is not valid and because the two actions were previously a click
 * and a double-click on the same target: the double-click armed a flag that swallowed the *next*
 * single click, so every other click appeared to do nothing.
 */
export function BlueprintNodeCard({
  title,
  kind,
  status,
  meta,
  detail,
  zoom,
  disabled,
  chainPosition,
  requirements,
  inLibrary,
  highlighted = false,
  onClick,
}: BlueprintNodeCardProps) {
  const KindIcon = kind.icon;
  const StatusIcon = status?.icon;
  const gates = requirements ?? [];
  const isCompact = detail === "compact" && !inLibrary;
  const titlePx = compactTitlePx(zoom);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full flex-col overflow-hidden rounded-xl bg-app-surface text-left",
        "transition-[box-shadow,transform,border-color,background-color] duration-150",
        "focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
        isCompact ? "justify-center" : "p-3",
        // In the library the card sits on a plain panel beside other list rows, where a loud
        // outline would shout. On the canvas it has to hold its own against a field of dots under
        // a vignette, so it takes two pixels of the strong border and a shadow that still reads at
        // the zoom where the whole graph fits. A ring of canvas colour outside it was the other
        // candidate and would have clipped the arrowheads that land on the border.
        inLibrary ? "border shadow-sm" : "border-2 shadow-md",
        highlighted
          ? "border-app-brand bg-app-brand-soft"
          : inLibrary
            ? "border-app-border"
            : "border-app-border-strong",
        disabled
          ? "cursor-default opacity-70"
          : // Depth is what tells a card from the surface it sits on: it lifts, its border comes up
            // to the brand colour, and the house's brand lift — a bloom cast *under* the card
            // rather than a halo around it — says which one the pointer is on without a highlight
            // that would compete with the selection ring.
            "hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-app-brand-lift motion-reduce:hover:translate-y-0",
        inLibrary ? "min-h-16" : "",
      ].join(" ")}
      style={{
        // Exactly the box the layout reserved for it. A card free to outgrow its own footprint is
        // a card the tidy layout leaves too little room for, which is how they end up overlapping.
        ...(inLibrary ? {} : { height: GRAPH_NODE_HEIGHT }),
        // Compact padding scales with the title for the same reason the title does: a 12px inset
        // beside a 39px word reads as no inset at all.
        ...(isCompact ? { padding: `${titlePx * 0.5}px` } : {}),
      }}
    >
      {isCompact ? (
        <>
          <span
            className="line-clamp-3 font-semibold text-app-text"
            style={{ fontSize: `${titlePx}px`, lineHeight: 1.15 }}
          >
            {title}
          </span>
          {status || gates.length > 0 ? (
            <span
              className="mt-1 flex items-center gap-1 truncate text-app-text-muted"
              style={{ fontSize: `${titlePx * 0.72}px`, lineHeight: 1.2 }}
            >
              {gates.length > 0 ? (
                <KeyRound
                  style={{ height: titlePx * 0.72, width: titlePx * 0.72 }}
                  className="shrink-0"
                  aria-hidden="true"
                />
              ) : null}
              {status ? status.label : `Only for ${gates.map((gate) => gate.label).join(", ")}`}
            </span>
          ) : null}
          <span className="sr-only">{kind.label}</span>
        </>
      ) : (
        <>
          <span className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-semibold text-app-text">{title}</span>
            <KindIcon className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
          </span>

          {/* The middle takes whatever is left over and clips, so the chips below never move. */}
          <span className="mt-1.5 min-h-0 flex-1 overflow-hidden">
            {meta ? (
              <span className="line-clamp-2 block text-xs text-app-text-muted">{meta}</span>
            ) : null}

            {gates.length > 0 ? (
              <span className="mt-1.5 flex items-start gap-1 text-xs text-app-text-muted">
                <KeyRound className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">
                  Only for {gates.map((gate) => gate.label).join(", ")}
                </span>
              </span>
            ) : null}
          </span>

          <span className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="neutral" size="sm">
              {kind.label}
            </Badge>
            {chainPosition ? (
              <Badge variant="brand" size="sm" title="Position in this chain of prerequisites">
                {chainPosition.index} of {chainPosition.total}
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm" title="Nothing sequences this one">
                No fixed order
              </Badge>
            )}
            {status ? (
              <Badge
                variant={status.variant}
                size="sm"
                className={StatusIcon ? "gap-1" : undefined}
              >
                {StatusIcon ? <StatusIcon className="h-3 w-3" aria-hidden="true" /> : null}
                {status.label}
              </Badge>
            ) : null}
          </span>
        </>
      )}
    </button>
  );
}
