import {
  Check,
  CheckCircle2,
  CircleHelp,
  FileText,
  Link2,
  Lock,
  MessageSquare,
  Play,
  RotateCcw,
  SkipForward,
  SquareCheckBig,
  ThumbsDown,
  ThumbsUp,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ItemState, PhaseItem, PhaseState } from "../journey";
import {
  feedbackOf,
  formatMinutes,
  itemState,
  phaseItems,
  phaseProgress,
  skipRequestOf,
} from "../journey";
import type { OnboardingPhaseEndpoint } from "../types";
import { ITEM_NODE_SIZE, itemGraphLayout } from "./graphLayouts";
import type { JourneyNodeRenderState } from "./JourneyCanvas";
import { itemKindLabel, itemStateLabel, phaseStateLabel } from "./nodeLabels";

const stateFrame: Record<ItemState, string> = {
  done: "border-app-success-border bg-app-surface",
  skipped: "border-app-border bg-app-surface",
  active:
    "border-app-brand bg-app-surface shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-app-brand)_18%,transparent),0_18px_40px_-20px_var(--color-app-brand)]",
  open: "border-app-brand-border bg-app-surface",
  retry: "border-app-warning-border bg-app-surface",
  locked: "border-dashed border-app-border bg-app-surface/70",
};

/** Questions carry their own colour in every state, so a locked one still reads as a question. */
const questionFrame: Record<ItemState, string> = {
  done: "border-app-success-border bg-app-question-bg/40",
  skipped: "border-app-border bg-app-question-bg/40",
  active: "border-app-question-solid bg-app-question-bg",
  open: "border-app-question-border bg-app-question-bg",
  retry: "border-app-warning-border bg-app-question-bg",
  locked: "border-dashed border-app-question-border/70 bg-app-question-bg/40",
};

const stateBadge: Record<ItemState, { icon: ReactNode; tone: string } | null> = {
  done: {
    icon: <Check className="h-2.5 w-2.5" strokeWidth={3} />,
    tone: "bg-app-success-solid text-white",
  },
  skipped: { icon: <SkipForward className="h-2.5 w-2.5" />, tone: "bg-app-text-subtle text-white" },
  active: {
    icon: <Play className="h-2.5 w-2.5" fill="currentColor" />,
    tone: "bg-app-brand text-white",
  },
  open: null,
  retry: {
    icon: <RotateCcw className="h-2.5 w-2.5" strokeWidth={3} />,
    tone: "bg-app-warning-solid text-white",
  },
  locked: { icon: <Lock className="h-2.5 w-2.5" />, tone: "bg-app-text-subtle text-white" },
};

export function ItemKindIcon({
  item,
  className = "h-3.5 w-3.5",
}: {
  item: PhaseItem;
  className?: string;
}) {
  if (item.kind === "question") return <CircleHelp className={className} aria-hidden="true" />;
  switch (item.step.type) {
    case "VIDEO":
      return <Video className={className} aria-hidden="true" />;
    case "DOCUMENT":
      return <FileText className={className} aria-hidden="true" />;
    case "LINK":
      return <Link2 className={className} aria-hidden="true" />;
    default:
      return <SquareCheckBig className={className} aria-hidden="true" />;
  }
}

/**
 * What an item is, drawn so the two kinds never look alike: a step sits in a circle, a question in a
 * violet diamond. The state rides along as a small badge in the corner instead of replacing the icon,
 * which is what used to make a locked question look exactly like a locked step.
 */
export function ItemGlyph({
  item,
  state,
  size = "md",
}: {
  item: PhaseItem;
  state: ItemState;
  size?: "sm" | "md";
}) {
  const badge = stateBadge[state];
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const muted = state === "done" || state === "skipped" || state === "locked";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center ${box}`}
      aria-hidden="true"
    >
      {item.kind === "question" ? (
        <span
          className={`absolute inset-[3px] rotate-45 rounded-md border ${
            muted
              ? "border-app-question-border bg-app-question-bg"
              : "border-app-question-solid bg-app-question-solid"
          }`}
        />
      ) : (
        <span
          className={`absolute inset-0 rounded-full border ${
            state === "active"
              ? "border-app-brand bg-app-brand"
              : muted
                ? "border-app-border bg-app-surface-muted"
                : "border-app-brand-border bg-app-brand-soft"
          }`}
        />
      )}
      <span
        className={`relative ${
          item.kind === "question"
            ? muted
              ? "text-app-question-text"
              : "text-white"
            : state === "active"
              ? "text-white"
              : muted
                ? "text-app-text-subtle"
                : "text-app-brand-text"
        }`}
      >
        <ItemKindIcon item={item} className="h-3.5 w-3.5" />
      </span>
      {badge ? (
        <span
          className={`absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-app-surface ${badge.tone}`}
        >
          {badge.icon}
        </span>
      ) : null}
    </span>
  );
}

function emphasisClass({ emphasis, selected, dragging }: JourneyNodeRenderState): string {
  return [
    emphasis === "dimmed" ? "opacity-35" : "opacity-100",
    selected ? "ring-2 ring-app-focus ring-offset-2 ring-offset-app-bg-soft" : "",
    emphasis === "focus" && !selected ? "ring-2 ring-app-brand/50" : "",
    dragging ? "scale-[1.03] shadow-2xl" : "",
  ].join(" ");
}

/**
 * What a step carries beyond its state -- a skip request, the member's feedback -- as small pills on
 * the card's top edge, so they can be seen without opening anything.
 */
export function ItemFlags({ item, inline = false }: { item: PhaseItem; inline?: boolean }) {
  const skip = skipRequestOf(item);
  const feedback = feedbackOf(item);
  if (!skip && !feedback) return null;
  return (
    <span
      className={
        inline
          ? "inline-flex flex-wrap items-center gap-1"
          : "absolute -top-2.5 right-3 z-10 inline-flex items-center gap-1"
      }
    >
      {skip ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${
            skip === "pending"
              ? "bg-app-warning-solid text-white"
              : "border border-app-warning-border bg-app-warning-bg text-app-warning-text"
          }`}
        >
          <SkipForward className="h-3 w-3" aria-hidden="true" />
          {skip === "pending" ? "Skip requested" : "Skip declined"}
        </span>
      ) : null}
      {feedback ? (
        <span
          title={
            feedback === "helpful"
              ? "Feedback: helpful"
              : feedback === "unhelpful"
                ? "Feedback: not helpful"
                : "Feedback given"
          }
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${
            feedback === "helpful"
              ? "bg-app-success-solid text-white"
              : feedback === "unhelpful"
                ? "bg-app-danger-solid text-white"
                : "bg-app-brand text-white"
          }`}
        >
          {feedback === "helpful" ? (
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          ) : feedback === "unhelpful" ? (
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
          )}
          {inline
            ? feedback === "helpful"
              ? "Helpful"
              : feedback === "unhelpful"
                ? "Not helpful"
                : "Feedback"
            : null}
          <span className="sr-only">
            {feedback === "helpful"
              ? "Marked helpful"
              : feedback === "unhelpful"
                ? "Marked not helpful"
                : "Feedback given"}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** One step or question on a phase graph. */
export function ItemNodeCard({
  item,
  state,
  render,
  isNext = false,
}: {
  item: PhaseItem;
  state: ItemState;
  render: JourneyNodeRenderState;
  isNext?: boolean;
}) {
  const minutes = item.kind === "step" ? item.step.estimatedMinutes : null;
  const isQuestion = item.kind === "question";

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-visible rounded-2xl border p-3 transition-[opacity,box-shadow,transform] duration-200 ${
        isQuestion ? questionFrame[state] : stateFrame[state]
      } ${emphasisClass(render)}`}
    >
      {isNext ? (
        <span
          className={`absolute -top-2.5 left-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow ${
            isQuestion ? "bg-app-question-solid" : "bg-app-brand"
          }`}
        >
          Up next
        </span>
      ) : null}
      <ItemFlags item={item} />
      <div className="flex items-start gap-2.5">
        <ItemGlyph item={item} state={state} size="sm" />
        <p
          className={`line-clamp-2 text-[13px] leading-snug font-semibold ${
            state === "done" || state === "skipped" || state === "locked"
              ? "text-app-text-muted"
              : "text-app-text"
          }`}
        >
          {item.title}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 pl-[38px] text-[11px] text-app-text-subtle">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          {isQuestion ? (
            <span className="rounded-full bg-app-question-solid/15 px-1.5 py-px font-semibold text-app-question-text">
              Question
            </span>
          ) : (
            itemKindLabel(item)
          )}
          {minutes ? <span aria-hidden="true">·</span> : null}
          {minutes ? formatMinutes(minutes) : null}
        </span>
        <span className="shrink-0 font-medium">{itemStateLabel[state]}</span>
      </div>
    </div>
  );
}

/** A circular progress ring, used for phases and the overall journey. */
export function ProgressRing({
  value,
  size = 40,
  stroke = 4,
  tone = "brand",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "brand" | "success" | "muted";
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const toneClass =
    tone === "success"
      ? "stroke-app-success-solid"
      : tone === "muted"
        ? "stroke-app-text-subtle"
        : "stroke-app-brand";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
          strokeDashoffset={offset}
          className={`${toneClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </span>
  );
}

const phaseFrame: Record<PhaseState, string> = {
  done: "border-app-success-border bg-app-surface",
  active:
    "border-app-brand bg-app-surface shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-app-brand)_18%,transparent),0_18px_40px_-20px_var(--color-app-brand)]",
  open: "border-app-brand-border bg-app-surface",
  locked: "border-dashed border-app-border bg-app-surface/70",
};

const previewFill: Record<ItemState, string> = {
  done: "fill-app-success-solid/70",
  skipped: "fill-app-text-subtle/40",
  active: "fill-app-brand",
  open: "fill-app-brand/45",
  retry: "fill-app-warning-solid/70",
  locked: "fill-app-text-subtle/25",
};

/**
 * A small picture of a phase's own graph, drawn from the same layout the phase opens with.
 *
 * That sameness is the point: on the journey map a phase already shows the shape inside it, so
 * zooming into the card lands on the graph the picture promised.
 */
function PhaseGraphPreview({ phase }: { phase: OnboardingPhaseEndpoint }) {
  const items = phaseItems(phase);
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-app-text-subtle">
        Nothing in this phase
      </div>
    );
  }
  const { positions } = itemGraphLayout(phase);
  const points = [...positions.values()];
  const halfWidth = ITEM_NODE_SIZE.width / 2;
  const halfHeight = ITEM_NODE_SIZE.height / 2;
  const minX = Math.min(...points.map((point) => point.x)) - halfWidth;
  const maxX = Math.max(...points.map((point) => point.x)) + halfWidth;
  const minY = Math.min(...points.map((point) => point.y)) - halfHeight;
  const maxY = Math.max(...points.map((point) => point.y)) + halfHeight;
  const pad = 40;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {items.flatMap((item) =>
        item.blockerIds.map((blockerId) => {
          const from = positions.get(blockerId);
          const to = positions.get(item.id);
          if (!from || !to) return null;
          return (
            <line
              key={`${blockerId}-${item.id}`}
              x1={from.x}
              y1={from.y + halfHeight}
              x2={to.x}
              y2={to.y - halfHeight}
              strokeWidth={10}
              className="stroke-app-text-subtle/35"
            />
          );
        }),
      )}
      {items.map((item) => {
        const point = positions.get(item.id);
        if (!point) return null;
        return (
          <rect
            key={item.id}
            x={point.x - halfWidth}
            y={point.y - halfHeight}
            width={ITEM_NODE_SIZE.width}
            height={ITEM_NODE_SIZE.height}
            rx={28}
            className={
              item.kind === "question" && itemState(item, phase.locked) !== "done"
                ? "fill-app-question-solid/55"
                : previewFill[itemState(item, phase.locked)]
            }
          />
        );
      })}
    </svg>
  );
}

/** One phase on the journey map: its progress, its state, and a picture of the graph inside it. */
export function PhaseNodeCard({
  index,
  phase,
  state,
  render,
  isFocus = false,
}: {
  index: number;
  phase: OnboardingPhaseEndpoint;
  state: PhaseState;
  render: JourneyNodeRenderState;
  /** The phase the member was last busy in. */
  isFocus?: boolean;
}) {
  const progress = phaseProgress(phase);
  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-2xl border p-3 transition-[opacity,box-shadow,transform] duration-200 ${phaseFrame[state]} ${emphasisClass(render)}`}
    >
      {isFocus ? (
        <span className="absolute -top-2.5 left-3 rounded-full bg-app-brand px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow">
          You are here
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <ProgressRing
          value={progress.percentage}
          size={36}
          tone={state === "done" ? "success" : state === "locked" ? "muted" : "brand"}
        >
          {state === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-app-success-text" aria-hidden="true" />
          ) : state === "locked" ? (
            <Lock className="h-3.5 w-3.5 text-app-text-subtle" aria-hidden="true" />
          ) : (
            <span className="text-[11px] font-bold text-app-text tabular-nums">{index + 1}</span>
          )}
        </ProgressRing>
        <p
          className={`line-clamp-2 text-sm leading-snug font-semibold ${
            state === "locked" ? "text-app-text-muted" : "text-app-text"
          }`}
        >
          {phase.title}
        </p>
      </div>
      <div className="my-2 min-h-0 flex-1 rounded-xl bg-app-bg-soft/80 p-1.5">
        <PhaseGraphPreview phase={phase} />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-app-text-subtle tabular-nums">
          {progress.completed}/{progress.total} done
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            state === "active"
              ? "bg-app-brand text-white"
              : state === "open"
                ? "bg-app-brand-soft text-app-brand-text"
                : state === "done"
                  ? "bg-app-success-bg text-app-success-text"
                  : "bg-app-surface-muted text-app-text-muted"
          }`}
        >
          {phaseStateLabel[state]}
        </span>
      </div>
    </div>
  );
}
