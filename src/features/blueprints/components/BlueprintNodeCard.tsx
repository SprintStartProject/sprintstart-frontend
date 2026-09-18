import { KeyRound, Maximize2, type LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { compactTitlePx, detailForZoom } from "../../graph-diagram/graphLayout.ts";
import type { BlueprintGraphCanvasNodeProps } from "./BlueprintGraphCanvas.tsx";

/**
 * The colour a node wears, by what it *is* — never for decoration.
 *
 * Six families rather than a palette: a reader has to be able to learn what each one means in one
 * pass over a legend, and a graph whose colours are a gradient of importance teaches nothing. Each
 * is carried by an accent bar and a tinted icon, and every one of them is also a word and an icon
 * on the card, because a colour nobody can distinguish has said nothing.
 */
export type NodeAccent = "brand" | "purple" | "orange" | "success" | "warning" | "neutral";

const ACCENTS: Record<
  NodeAccent,
  { bar: string; icon: string; ring: string; badge: string; stroke: string }
> = {
  brand: {
    bar: "bg-app-brand",
    icon: "bg-app-brand-soft text-app-brand-text",
    badge: "bg-app-brand text-white",
    stroke: "stroke-app-brand",
    ring: "group-hover/card:border-app-brand-border-strong",
  },
  purple: {
    bar: "bg-app-purple-text",
    icon: "bg-app-purple-bg text-app-purple-text",
    badge: "bg-app-purple-text text-white",
    stroke: "stroke-app-purple-text",
    ring: "group-hover/card:border-app-purple-border",
  },
  orange: {
    bar: "bg-app-orange-text",
    icon: "bg-app-orange-bg text-app-orange-text",
    badge: "bg-app-orange-text text-white",
    stroke: "stroke-app-orange-text",
    ring: "group-hover/card:border-app-orange-border",
  },
  success: {
    bar: "bg-app-success-solid",
    icon: "bg-app-success-bg text-app-success-text",
    badge: "bg-app-success-solid text-white",
    stroke: "stroke-app-success-solid",
    ring: "group-hover/card:border-app-success-border",
  },
  warning: {
    bar: "bg-app-warning-solid",
    icon: "bg-app-warning-bg text-app-warning-text",
    badge: "bg-app-warning-solid text-white",
    stroke: "stroke-app-warning-solid",
    ring: "group-hover/card:border-app-warning-border",
  },
  neutral: {
    bar: "bg-app-border-strong",
    icon: "bg-app-surface-muted text-app-text-muted",
    badge: "bg-app-text-subtle text-white",
    stroke: "stroke-app-text-subtle",
    ring: "group-hover/card:border-app-border-strong",
  },
};

/**
 * The shape a node's glyph is drawn in.
 *
 * A second carrier beside the colour, and the one that survives both a colour-blind reader and the
 * zoom where the accent is three pixels wide. Borrowed from the journey graph, where a locked
 * question and a locked step were indistinguishable until the two kinds were given different
 * outlines.
 */
export type NodeGlyphShape = "round" | "diamond";

export type BlueprintNodeCardProps = BlueprintGraphCanvasNodeProps & {
  title: string;
  /**
   * What kind of thing this is — a phase, a step, a knowledge check.
   *
   * Always a word and an icon, never a colour on its own: the kinds have to stay apart for someone
   * who cannot tell the accents apart.
   */
  kind: { label: string; icon: LucideIcon };
  /** Which of the six families this kind belongs to. Defaults to the quiet one. */
  accent?: NodeAccent;
  /** The outline its glyph is drawn in. A check is a diamond; everything else is round. */
  glyph?: NodeGlyphShape;
  /**
   * How far through this node its owner is, where that is a thing to be part-way through.
   *
   * Drawn as a ring around the glyph rather than as a bar: a bar needs a row of its own, and on a
   * card this size a row is a tenth of the card. The ring costs nothing — the glyph was going to be
   * there anyway.
   */
  progress?: { done: number; total: number };
  /** Where the node stands, on the surfaces that have a state to show (the hire's read-only view). */
  status?: { label: string; variant: BadgeVariant; icon?: LucideIcon };
  /**
   * The two or three numbers this node is worth comparing by, each with the word for what it counts.
   *
   * Counts rather than prose: "4 steps · 2 checks" is read at a glance and a sentence saying the
   * same is not, and on a canvas the glance is the whole interaction.
   */
  metrics?: { icon: LucideIcon; value: number; label: string }[];
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
 * one component with a `kind`, an `accent` and an optional `status`.
 *
 * **A picture, not a control.** The canvas around it is one widget: it owns the click that selects,
 * the keys that move between nodes and the drag that places one, and a node is a `role="button"`
 * inside it. So this is a plain element. It used to be a `<button>`, which put a button inside a
 * button the moment the card grew a control of its own — and left the card and the canvas each
 * with their own idea of what a click meant.
 *
 * **Two states, not one shrunk.** A card that is simply scaled down is unreadable at the zoom
 * where a whole blueprint fits, which is the zoom most people look at one from — the seeded
 * blueprint's sixteen phases are stored across 1663 x 1412px and fit at about a third. So what the
 * card *says* changes with the distance it is read at:
 *
 * - **near** — the title, what kind of thing it is, and the two or three numbers worth comparing
 *   two nodes by. Prose that was here went to the panel: a sentence on a card is a sentence
 *   nobody reads at a glance and everybody scrolls past.
 * - **far** — a map label: the icon, and the title sized against the zoom so it stays legible on
 *   screen however far out the reader is. The card gives the context line's room to the title at
 *   the point that line stops being readable, which is well before the title does.
 *
 * Every part is always in the DOM and fades between tiers rather than appearing and vanishing:
 * things popping in and out while somebody zooms is what makes a canvas feel like it is fighting
 * them. The one thing that does move is the title's alignment, which cannot be interpolated — the
 * fade is timed to cover it.
 */
export function BlueprintNodeCard({
  title,
  kind,
  accent = "neutral",
  glyph = "round",
  progress,
  status,
  metrics,
  disabled,
  chainPosition,
  requirements,
  highlighted = false,
  zoom,
  onOpen,
}: BlueprintNodeCardProps) {
  const KindIcon = kind.icon;
  const StatusIcon = status?.icon;
  const gates = requirements ?? [];
  const palette = ACCENTS[accent];
  const isFar = detailForZoom(zoom) === "far";
  const titlePx = compactTitlePx(zoom);

  return (
    <div
      className={[
        "group/card relative flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-app-surface text-left shadow-md",
        "transition-[box-shadow,transform,border-color,background-color] duration-200 ease-out",
        highlighted
          ? "border-app-brand bg-app-brand-soft"
          : `border-app-border-strong ${palette.ring}`,
        disabled
          ? "opacity-70"
          : // Depth is what tells a card from the surface it sits on: it lifts, its border comes up
            // to its own accent, and the house's brand lift — a bloom cast *under* the card rather
            // than a halo around it — says which one the pointer is on.
            "group-hover/node:-translate-y-0.5 group-hover/node:shadow-app-brand-lift motion-reduce:group-hover/node:translate-y-0",
      ].join(" ")}
    >
      {/*
        The accent bar rather than a tinted card. A whole surface in a colour competes with every
        other signal on the canvas — the arrows, the selection ring, the dimming — and a graph where
        six of those fight is one nobody can read. A three-pixel edge is enough to group by and
        quiet enough to ignore.
      */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${palette.bar}`} />

      {/*
        Shown on approach rather than always. `nodrag` is not needed — the canvas starts a node drag
        from a pointer-down anywhere on the node — so the control stops the click from also reaching
        the canvas, which would otherwise open the details panel behind the graph it just left.
      */}
      {onOpen ? (
        <span className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/node:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label={`Open ${title}`}
            title={`Open ${title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ) : null}

      <span className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 py-2.5 pr-2.5 pl-3.5">
        <span className="flex items-start gap-2">
          {/*
            Kind and state in one glyph: the outline says what this is, the badge in its corner says
            where it stands. Two separate chips said the same two things and cost a row each.
          */}
          <span
            aria-hidden="true"
            className="relative flex shrink-0 items-center justify-center"
            style={isFar ? { height: titlePx, width: titlePx } : { height: 22, width: 22 }}
          >
            <span
              className={`absolute ${
                glyph === "diamond" ? "inset-[2px] rotate-45 rounded-[4px]" : "inset-0 rounded-full"
              } ${palette.icon}`}
            />
            {progress && progress.total > 0 ? (
              <ProgressRing done={progress.done} total={progress.total} accent={accent} />
            ) : null}
            <KindIcon
              className="relative"
              style={
                isFar
                  ? { height: titlePx * 0.55, width: titlePx * 0.55 }
                  : { height: 12, width: 12 }
              }
            />
            {StatusIcon ? (
              <span
                className={`absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-app-surface ${palette.badge}`}
              >
                <StatusIcon className="h-2 w-2" strokeWidth={3} />
              </span>
            ) : null}
          </span>

          <span
            className={`min-w-0 flex-1 font-semibold text-app-text transition-[font-size] duration-200 ${
              // Three lines at a distance, where the title is the only thing on the card and has
              // the whole of it to use. Two anywhere else, where it shares.
              isFar ? "line-clamp-3" : "line-clamp-2"
            }`}
            style={
              isFar ? { fontSize: titlePx, lineHeight: 1.15 } : { fontSize: 13, lineHeight: 1.3 }
            }
          >
            {title}
          </span>
        </span>

        {/*
          One line under the title, and everything that is not the title lives on it: what kind of
          thing this is, where it stands, what it holds, how far along the chain it sits. Separate
          rows for each of those is what left a card two thirds empty on a node that had only two
          of them — and made a graph of sixteen nodes twice as tall as it needed to be.
        */}
        {/*
          Faded rather than unmounted at a distance, so the card's height never changes as somebody
          zooms: a card that resizes under the pointer moves the thing being aimed at.
        */}
        <span
          aria-hidden={isFar}
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-none text-app-text-muted transition-opacity duration-200 ${
            isFar ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <span className="font-medium">{kind.label}</span>

          {(metrics ?? []).map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <span key={metric.label} className="flex items-center gap-1">
                <MetricIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="font-semibold text-app-text tabular-nums">{metric.value}</span>
                {metric.label}
              </span>
            );
          })}

          {gates.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1">
              <KeyRound className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{gates.map((gate) => gate.label).join(", ")}</span>
            </span>
          ) : null}

          {/*
            Only where there is a chain to be in. "No fixed order" was on every card of every graph
            nobody had connected, which is to say on all of them — a badge that never varies is a
            badge that distinguishes nothing, and it cost a row on every card to say so.
          */}
          {chainPosition ? (
            <Badge variant="brand" size="sm" title="Position in this chain of prerequisites">
              {chainPosition.index} of {chainPosition.total}
            </Badge>
          ) : null}

          {/*
            A word rather than a chip. The glyph's corner badge already draws the state; the word is
            what a screen reader gets and what somebody who cannot tell two small glyphs apart gets,
            and as plain text it costs a few pixels instead of a bordered box.
          */}
          {status ? <span className="ml-auto font-medium">{status.label}</span> : null}
        </span>
      </span>
    </div>
  );
}

/**
 * How far through a node its owner is, as a ring around its glyph.
 *
 * Drawn on top of the glyph's own outline rather than beside it: the glyph is already the thing a
 * reader's eye lands on, and a progress bar on a card this size would be a row spent on one number.
 */
function ProgressRing({
  done,
  total,
  accent,
}: {
  done: number;
  total: number;
  accent: NodeAccent;
}) {
  // Larger than the glyph it surrounds, so the ring reads as a ring rather than as the glyph's own
  // edge. Drawn on the same centre, which is why it is offset by half the difference.
  const size = 30;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width={size}
      height={size}
      aria-hidden="true"
      className="absolute -rotate-90"
      style={{ overflow: "visible", left: "50%", top: "50%", margin: -size / 2 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-app-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, done / total)))}
        className={`${ACCENTS[accent].stroke} transition-[stroke-dashoffset] duration-700 ease-out`}
      />
    </svg>
  );
}
