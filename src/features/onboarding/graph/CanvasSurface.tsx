import type { DOMAttributes, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import type { Viewport } from "./cameraMath";

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  viewport: Viewport;
  /** The pointer and key handlers of the focusable canvas. */
  handlers: Pick<
    DOMAttributes<HTMLDivElement>,
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
    | "onPointerCancel"
    | "onDoubleClick"
    | "onKeyDown"
  >;
  expanded: boolean;
  heightClassName: string;
  /** Edges and nodes, which share the one transform that maps the world onto the screen. */
  world: ReactNode;
  /** The menu of the picked edge, placed in screen coordinates over the world. */
  edgeMenu: ReactNode;
  overlay?: ReactNode;
  aside?: ReactNode;
  /** A node zoomed into until it is a page; while it is there the graph behind is inert. */
  cover?: ReactNode;
  minimap: ReactNode;
  zoomBar: ReactNode;
};

type CornersProps = Pick<Props, "overlay" | "aside" | "cover">;

/** What the owner lays over the canvas: a legend top left, details right, a page over everything. */
function CanvasCorners({ overlay, cover, aside }: CornersProps) {
  const inert = cover ? true : undefined;
  return (
    <>
      {overlay ? (
        <div
          data-canvas-control
          inert={inert}
          className="pointer-events-none absolute top-3 left-3 z-40 max-w-[calc(100%-1.5rem)]"
        >
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      ) : null}

      {cover ? (
        <div data-canvas-control className="absolute inset-0 z-50">
          {cover}
        </div>
      ) : null}

      {aside ? (
        <div
          data-canvas-control
          inert={inert}
          className="absolute top-3 right-3 bottom-16 z-40 w-[min(22rem,calc(100%-1.5rem))]"
        >
          {aside}
        </div>
      ) : null}
    </>
  );
}

/** The canvas frame: the dotted, pannable background, the world on top and the controls over it. */
function CanvasBody({ containerRef, handlers, ...props }: Props) {
  const { viewport, cover, overlay, aside } = props;
  const gridSize = 24 * viewport.zoom;
  const inert = cover ? true : undefined;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-app-border bg-app-bg-soft ${
        props.expanded ? "h-full" : props.heightClassName
      }`}
    >
      {/* The canvas is one focusable widget: it takes the pointer gestures and the zoom keys, and its
          nodes are the focusable buttons inside it. `application` is the role for exactly that, but the
          a11y lint only knows it as non-interactive. */}
      <div
        ref={containerRef}
        role="application"
        aria-label={props.ariaLabel}
        aria-roledescription="graph"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the canvas is the focusable widget, see above
        tabIndex={0}
        // While a node is open as a page over the graph, the graph is not there to be used: its
        // nodes, the minimap and the zoom toolbar would otherwise all still be tab stops behind
        // what was opened, which is the long way round to the thing in front.
        inert={inert}
        className="absolute inset-0 cursor-grab touch-none focus-ring-inset select-none active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(var(--color-app-border) 1.2px, transparent 1.2px)",
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        {...handlers}
      >
        <div
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {props.world}
        </div>
        {props.edgeMenu}
      </div>

      <CanvasCorners {...{ overlay, cover, aside }} />

      {props.minimap}
      {props.zoomBar}
    </div>
  );
}

/**
 * The canvas, inline or -- expanded -- over the whole screen.
 *
 * Expanded, it leaves the page's layout and takes the screen. A portal, so no ancestor's
 * transform or overflow clips the fixed layer; a dashed placeholder keeps the page from jumping.
 */
export function CanvasSurface(props: Props) {
  const body = <CanvasBody {...props} />;
  if (!props.expanded) return body;
  return (
    <>
      <div
        className={`${props.heightClassName} rounded-3xl border border-dashed border-app-border`}
      />
      {createPortal(
        <div className="fixed inset-0 z-[70] bg-app-overlay p-3 backdrop-blur-sm sm:p-6">
          {body}
        </div>,
        document.body,
      )}
    </>
  );
}
