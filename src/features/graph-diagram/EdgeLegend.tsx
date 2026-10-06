import type { JourneyEdgeTone } from "../onboarding/graph/JourneyCanvas.tsx";
import { EDGE_STYLE_SWATCH } from "./edgeStyles.ts";

/** What each style is called in a legend. */
const TONE_LABEL: Record<JourneyEdgeTone, string> = {
  done: "done",
  active: "ready now",
  waiting: "waiting",
  upstream: "comes first",
  rule: "locks",
};

/**
 * A short sample of one edge style, drawn from the table the canvas strokes with.
 *
 * Decorative: the style's name is always written beside it, so a screen reader gets the words and
 * nobody has to tell the lines apart by colour.
 */
export function EdgeSwatch({
  tone,
  length = 28,
  className = "",
}: {
  tone: JourneyEdgeTone;
  length?: number;
  className?: string;
}) {
  const style = EDGE_STYLE_SWATCH[tone];

  return (
    <svg width={length} height="8" aria-hidden="true" className={`shrink-0 ${className}`}>
      <line
        x1={style.linecap === "round" ? 1.5 : 0}
        y1="4"
        x2={length - (style.linecap === "round" ? 1.5 : 0)}
        y2="4"
        fill="none"
        className={style.className}
        strokeWidth={style.width}
        strokeDasharray={style.dash}
        strokeLinecap={style.linecap}
      />
    </svg>
  );
}

/**
 * The key to an edge style, as a row of sample line and word. Tells the arrows on a graph apart
 * without their colour, which is the only other thing that says what state one is in.
 */
export function EdgeLegend({
  tones,
  className = "",
}: {
  tones: readonly JourneyEdgeTone[];
  className?: string;
}) {
  return (
    <ul
      aria-label="Arrow styles"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-app-text-muted ${className}`}
    >
      {tones.map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <EdgeSwatch tone={tone} />
          {TONE_LABEL[tone]}
        </li>
      ))}
    </ul>
  );
}
