import type { PathShape } from "../pathShape.ts";

/**
 * A blueprint's graph at thumbnail size, as the card's own portrait.
 *
 * Nothing is labelled, because nothing at this size could be read. What survives shrinking is the
 * shape — a trail, a fan, a knot — and that is the one thing a list of counts cannot say. It is
 * the difference between sixteen phases somebody has to walk in order and sixteen they get to
 * choose among.
 *
 * `aria-hidden`, with the same fact given in words beside it: this is a picture that helps a reader
 * scanning a page recognise something they have seen before, and a screen reader being handed a
 * list of node coordinates would be given work instead of information.
 */
export function BlueprintShapeStrip({
  shape,
  className = "",
}: {
  shape: PathShape;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={shape.viewBox}
      // `meet` rather than `none`: the aspect ratio *is* the information here. A wide graph
      // squashed into a square box would be drawn as the tall narrow one it is not.
      preserveAspectRatio="xMidYMid meet"
      className={`overflow-visible ${className}`}
    >
      {shape.edges.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          strokeWidth="1.25"
          strokeLinecap="round"
          // The stroke keeps its screen weight however far the viewBox is scaled down, so a
          // sixteen-node graph does not draw itself in hairlines.
          vectorEffect="non-scaling-stroke"
          className="stroke-app-border-strong"
        />
      ))}

      {shape.nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={shape.radius}
          // A starting point is filled, everything else is an outline. At this size that is the
          // only distinction worth drawing, and it is the one that says where the thing begins.
          className={node.entry ? "fill-app-brand" : "fill-app-surface stroke-app-border-strong"}
          strokeWidth={node.entry ? 0 : 1.25}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
