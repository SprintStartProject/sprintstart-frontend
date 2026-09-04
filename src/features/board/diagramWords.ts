import type { DiagramEdgeKind, DiagramNode, DiagramNodeKind } from "./types";

/**
 * The words a diagram is read in.
 *
 * Kept beside the types rather than inside a component because the picture and the list have to say
 * the same thing — a diagram whose canvas and whose text equivalent describe different relationships
 * is worse than one that only has a canvas, since only one of the two readers would notice.
 */

/** What each kind of box is, in the hire's words rather than the catalog's. */
export const NODE_KIND_WORDS: Record<DiagramNodeKind, string> = {
  COMPONENT: "part of this project",
  FILE: "file",
  SERVICE: "service",
  DATA: "data",
  STEP: "step",
  EXTERNAL: "outside this project",
  OTHER: "part",
};

/** How each arrow reads in a sentence. `RELATES_TO` stays vague because the evidence was. */
export const EDGE_KIND_WORDS: Record<DiagramEdgeKind, string> = {
  FLOWS_TO: "goes to",
  DEPENDS_ON: "depends on",
  CONTAINS: "contains",
  RELATES_TO: "is connected to",
};

/** A relationship the evidence would not name must not be drawn like a dependency. */
export function isSoftEdge(kind: DiagramEdgeKind): boolean {
  return kind === "RELATES_TO";
}

/**
 * What a screen reader says for a box: its name, what kind of thing it is, and where it came from.
 *
 * The source is part of the name rather than a detail behind a hover, because for somebody reading
 * by ear the hover does not exist — and a box's source is what makes it checkable.
 */
export function ariaLabelFor(node: DiagramNode): string {
  const kind = NODE_KIND_WORDS[node.kind] ?? NODE_KIND_WORDS.OTHER;
  const source = node.citations[0]?.filename;
  return source ? `${node.label}, ${kind}, from ${source}` : `${node.label}, ${kind}`;
}
