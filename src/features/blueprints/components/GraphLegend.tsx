import { useId } from "react";
import { Flag, KeyRound, X } from "lucide-react";
import { EdgeSwatch, LOCK_SENTENCE } from "../graphKit.ts";

/** The arrow the legend explains, drawn the way the canvas draws one. */
function LockArrow() {
  // Per instance: two canvases mounted at once (the board's read-only window beside an editor)
  // would otherwise define the same marker id twice, and the second arrow would point at the
  // first one's definition.
  const arrowId = `${useId()}-legend-arrow`;
  return (
    <svg width="34" height="10" aria-hidden="true" className="shrink-0 overflow-visible">
      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="7" refY="2.5" orient="auto">
          <path d="M0,0 L0,5 L7,2.5 z" className="fill-app-text-muted" />
        </marker>
      </defs>
      {/* The same curve the canvas draws, so the legend explains what is actually on screen. */}
      <path
        d="M0,9 C10,9 16,1 26,1"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-app-text-muted"
        markerEnd={`url(#${arrowId})`}
      />
    </svg>
  );
}

/**
 * What the one relation on this canvas means, spelled out.
 *
 * Without it an arrow gets read as a suggested route and the absence of one as "do these in the
 * order they are drawn" — both wrong, and both invisible until a hire is standing in front of a
 * locked phase asking why.
 */
export function GraphLegend({ editable, onClose }: { editable: boolean; onClose: () => void }) {
  return (
    <div className="relative flex max-w-96 flex-col gap-2 rounded-2xl border border-app-border bg-app-surface/95 p-3 pr-8 text-xs leading-snug text-app-text-muted shadow-md backdrop-blur">
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide the legend"
        className="absolute top-1 right-1 rounded p-1.5 text-app-text-subtle transition-colors hover:text-app-text"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="flex items-center gap-2">
        <LockArrow />
        {LOCK_SENTENCE}
      </span>
      <span className="flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 shrink-0 text-app-brand" aria-hidden="true" />
        Nothing has to happen before these — any of them is a place to start.
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="flex shrink-0 flex-col gap-1">
          <EdgeSwatch tone="upstream" />
          <EdgeSwatch tone="active" />
        </span>
        Point at a node and its run lights up: the orange dash-dot line for what has to happen
        before it, the dashed brand line for what finishing it opens.
      </span>
      <span className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        &ldquo;Only for &hellip;&rdquo; is the other kind of lock: a skill or role gate, so the node
        opens for some people and not others.
      </span>
      <span>
        Nodes with no arrow between them are in <strong className="font-semibold">no</strong>{" "}
        particular order, and say so. &ldquo;2 of 4&rdquo; counts only within one chain.
      </span>
      {editable ? (
        <span className="text-app-text-subtle">
          Click a node to edit it, double-click the canvas to make one. To lock one behind another,
          drag from the dot under the first onto the second. Click an arrow to pick it out, then
          remove it with Backspace or the button on it.
        </span>
      ) : null}
    </div>
  );
}
