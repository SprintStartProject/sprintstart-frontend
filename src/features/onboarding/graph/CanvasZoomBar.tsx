import { Maximize2, Minimize2, Minus, Plus, Scan } from "lucide-react";
import type { ReactNode } from "react";
import { CanvasButton } from "./CanvasButton";
import { ZOOM_STEP } from "./cameraMath";

type Props = {
  zoom: number;
  expanded: boolean;
  /** The owner's own controls, shown before the zoom ones. */
  toolbar?: ReactNode;
  zoomBy: (factor: number) => void;
  fit: () => void;
  toggleExpanded: () => void;
};

/** The floating toolbar: the owner's controls, then zoom out, reset, zoom in, fit and full screen. */
export function CanvasZoomBar({ zoom, expanded, toolbar, zoomBy, fit, toggleExpanded }: Props) {
  return (
    <div
      data-canvas-control
      className="absolute right-3 bottom-3 z-40 flex items-center gap-1 rounded-2xl border border-app-border/70 bg-app-surface/85 p-1 shadow-lg backdrop-blur-md"
    >
      {toolbar}
      {toolbar ? <span className="mx-0.5 h-5 w-px bg-app-border" aria-hidden="true" /> : null}
      <CanvasButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
        <Minus className="h-4 w-4" />
      </CanvasButton>
      <button
        type="button"
        onClick={() => zoomBy(1 / zoom)}
        className="min-w-12 rounded-lg px-1.5 py-1 text-xs font-semibold text-app-text-muted tabular-nums hover:bg-app-surface-hover hover:text-app-text"
        aria-label="Reset zoom to 100%"
        title="Reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <CanvasButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
        <Plus className="h-4 w-4" />
      </CanvasButton>
      <CanvasButton label="Fit graph to view" onClick={fit}>
        <Scan className="h-4 w-4" />
      </CanvasButton>
      <CanvasButton label={expanded ? "Leave full screen" : "Full screen"} onClick={toggleExpanded}>
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </CanvasButton>
    </div>
  );
}
